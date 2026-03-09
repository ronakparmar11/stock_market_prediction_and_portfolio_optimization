import numpy as np
import pandas as pd
from typing import List, Dict, Any
from scipy.optimize import minimize
import logging

from services.data_service import get_multi_stock_prices

logger = logging.getLogger(__name__)

TRADING_DAYS = 252


def compute_portfolio_stats(weights: np.ndarray, mean_returns: np.ndarray, cov_matrix: np.ndarray) -> tuple:
    """Compute annualized return, volatility, and Sharpe ratio for a weight vector."""
    port_return = np.dot(weights, mean_returns) * TRADING_DAYS
    port_vol = np.sqrt(np.dot(weights.T, np.dot(cov_matrix * TRADING_DAYS, weights)))
    sharpe = port_return / port_vol if port_vol > 0 else 0
    return port_return, port_vol, sharpe


def optimize_portfolio(symbols: List[str], period: str = "1y", num_portfolios: int = 3000) -> Dict[str, Any]:
    try:
        prices = get_multi_stock_prices(symbols, period)
        if prices.empty:
            raise ValueError("Could not fetch price data for the given symbols.")

        # Keep only columns that could be fetched
        available = [s for s in symbols if s in prices.columns]
        if len(available) < 2:
            raise ValueError("Need at least 2 valid stocks for portfolio optimization.")

        prices = prices[available]
        returns = prices.pct_change().dropna()

        mean_returns = returns.mean().values
        cov_matrix = returns.cov().values
        n_assets = len(available)

        # --- Monte Carlo Simulation ---
        mc_returns, mc_vols, mc_sharpes, mc_weights = [], [], [], []
        np.random.seed(42)
        for _ in range(num_portfolios):
            w = np.random.dirichlet(np.ones(n_assets))
            r, v, s = compute_portfolio_stats(w, mean_returns, cov_matrix)
            mc_returns.append(r)
            mc_vols.append(v)
            mc_sharpes.append(s)
            mc_weights.append(w)

        # --- Optimal portfolio: max Sharpe ---
        best_idx = np.argmax(mc_sharpes)
        opt_weights = mc_weights[best_idx]

        # --- Scipy optimization for true max Sharpe ---
        def neg_sharpe(w):
            r, v, s = compute_portfolio_stats(w, mean_returns, cov_matrix)
            return -s

        constraints = [{"type": "eq", "fun": lambda w: np.sum(w) - 1}]
        bounds = [(0.01, 0.99)] * n_assets
        init_w = np.ones(n_assets) / n_assets

        try:
            result = minimize(neg_sharpe, init_w, method="SLSQP", bounds=bounds, constraints=constraints,
                              options={"maxiter": 1000, "ftol": 1e-9})
            if result.success:
                opt_weights = result.x
        except Exception:
            pass  # fall back to Monte Carlo best

        opt_return, opt_vol, opt_sharpe = compute_portfolio_stats(opt_weights, mean_returns, cov_matrix)

        # --- Efficient frontier (100 points) ---
        min_ret = min(mc_returns)
        max_ret = max(mc_returns)
        target_returns = np.linspace(min_ret, max_ret, 40)
        ef_points = []

        for target_r in target_returns:
            def port_vol_fn(w):
                _, v, _ = compute_portfolio_stats(w, mean_returns, cov_matrix)
                return v

            cons = [
                {"type": "eq", "fun": lambda w: np.sum(w) - 1},
                {"type": "eq", "fun": lambda w, tr=target_r: compute_portfolio_stats(w, mean_returns, cov_matrix)[0] - tr},
            ]
            try:
                res = minimize(port_vol_fn, init_w, method="SLSQP", bounds=bounds, constraints=cons,
                               options={"maxiter": 500})
                if res.success:
                    _, ef_v, ef_s = compute_portfolio_stats(res.x, mean_returns, cov_matrix)
                    ef_points.append({"return": round(float(target_r * 100), 3), "volatility": round(float(ef_v * 100), 3), "sharpe": round(float(ef_s), 3)})
            except Exception:
                pass

        # Fallback: use MC frontier if optimization fails
        if len(ef_points) < 5:
            # Just use the MC frontier
            mc_arr = sorted(zip(mc_vols, mc_returns, mc_sharpes), key=lambda x: x[1])
            for vol, ret, shr in mc_arr[::max(1, len(mc_arr)//40)]:
                ef_points.append({"return": round(float(ret * 100), 3), "volatility": round(float(vol * 100), 3), "sharpe": round(float(shr), 3)})

        # --- Individual stock stats ---
        individual_stats = {}
        for i, sym in enumerate(available):
            ann_ret = float(mean_returns[i]) * TRADING_DAYS
            ann_vol = float(returns[sym].std()) * np.sqrt(TRADING_DAYS)
            individual_stats[sym] = {
                "expected_return": round(ann_ret * 100, 3),
                "volatility": round(ann_vol * 100, 3),
                "sharpe": round(ann_ret / ann_vol if ann_vol > 0 else 0, 3),
                "weight": round(float(opt_weights[i]) * 100, 2),
            }

        # Correlation matrix
        corr = returns.corr()
        corr_dict = {sym: {s: round(float(corr.loc[sym, s]), 4) for s in available} for sym in available}

        # MC for scatter plot (sample 500 points)
        sample_idx = np.random.choice(len(mc_returns), min(500, len(mc_returns)), replace=False)
        mc_scatter = [
            {"return": round(float(mc_returns[i] * 100), 2), "volatility": round(float(mc_vols[i] * 100), 2), "sharpe": round(float(mc_sharpes[i]), 3)}
            for i in sample_idx
        ]

        return {
            "symbols": available,
            "optimal_weights": {sym: round(float(opt_weights[i]) * 100, 2) for i, sym in enumerate(available)},
            "expected_return": round(float(opt_return) * 100, 3),
            "volatility": round(float(opt_vol) * 100, 3),
            "sharpe_ratio": round(float(opt_sharpe), 3),
            "efficient_frontier": ef_points,
            "mc_scatter": mc_scatter,
            "correlation_matrix": corr_dict,
            "individual_stats": individual_stats,
        }
    except Exception as e:
        logger.error(f"Portfolio optimization error: {e}")
        raise
