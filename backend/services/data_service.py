import yfinance as yf
import pandas as pd
import numpy as np
from typing import List, Dict, Any, Optional
import logging
from services.cache_service import cache, make_cache_key

logger = logging.getLogger(__name__)

POPULAR_STOCKS = [
    "AAPL", "MSFT", "GOOGL", "AMZN", "NVDA",
    "META", "TSLA", "BRK-B", "JPM", "JNJ",
    "V", "UNH", "XOM", "MA", "HD",
    "NFLX", "AMD", "PYPL", "ORCL", "INTC",
]

MARKET_INDICES = ["^GSPC", "^DJI", "^IXIC", "^RUT"]
INDEX_NAMES = {
    "^GSPC": "S&P 500",
    "^DJI": "Dow Jones",
    "^IXIC": "NASDAQ",
    "^RUT": "Russell 2000",
}

SECTOR_ETFS = {
    "Technology": "XLK",
    "Financials": "XLF",
    "Healthcare": "XLV",
    "Energy": "XLE",
    "Consumer Disc.": "XLY",
    "Industrials": "XLI",
    "Real Estate": "XLRE",
    "Utilities": "XLU",
    "Materials": "XLB",
    "Communication": "XLC",
}


# ────────────────────────────────────────────────────────────
# Technical Indicator Helpers
# ────────────────────────────────────────────────────────────

def compute_rsi(series: pd.Series, period: int = 14) -> pd.Series:
    delta = series.diff()
    gain = delta.clip(lower=0)
    loss = -delta.clip(upper=0)
    avg_gain = gain.ewm(com=period - 1, min_periods=period).mean()
    avg_loss = loss.ewm(com=period - 1, min_periods=period).mean()
    rs = avg_gain / avg_loss
    return 100 - (100 / (1 + rs))


def compute_macd(series: pd.Series, fast: int = 12, slow: int = 26, signal: int = 9):
    ema_fast = series.ewm(span=fast, adjust=False).mean()
    ema_slow = series.ewm(span=slow, adjust=False).mean()
    macd = ema_fast - ema_slow
    macd_signal = macd.ewm(span=signal, adjust=False).mean()
    return macd, macd_signal


def compute_bollinger_bands(series: pd.Series, period: int = 20):
    sma = series.rolling(window=period).mean()
    std = series.rolling(window=period).std()
    upper = sma + (std * 2)
    lower = sma - (std * 2)
    return upper, sma, lower


def add_technical_indicators(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    close = df["Close"]

    df["ma20"] = close.rolling(window=20).mean()
    df["ma50"] = close.rolling(window=50).mean()
    df["ma200"] = close.rolling(window=200).mean()
    df["ema20"] = close.ewm(span=20, adjust=False).mean()

    df["rsi"] = compute_rsi(close)
    df["macd"], df["macd_signal"] = compute_macd(close)
    df["macd_hist"] = df["macd"] - df["macd_signal"]
    df["bb_upper"], df["bb_mid"], df["bb_lower"] = compute_bollinger_bands(close)

    df["daily_return"] = close.pct_change() * 100
    df["volatility"] = df["daily_return"].rolling(window=20).std()
    df["log_return"] = np.log(close / close.shift(1))

    df["momentum_5"] = close.pct_change(5) * 100
    df["momentum_10"] = close.pct_change(10) * 100
    df["momentum_20"] = close.pct_change(20) * 100

    # ATR (Average True Range)
    high_low = df["High"] - df["Low"]
    high_prev_close = abs(df["High"] - close.shift(1))
    low_prev_close = abs(df["Low"] - close.shift(1))
    tr = pd.concat([high_low, high_prev_close, low_prev_close], axis=1).max(axis=1)
    df["atr"] = tr.rolling(14).mean()

    return df


# ────────────────────────────────────────────────────────────
# Stock History
# ────────────────────────────────────────────────────────────

def get_stock_history(symbol: str, period: str = "1y") -> List[Dict[str, Any]]:
    cache_key = make_cache_key("history", symbol, period)
    cached = cache.get(cache_key)
    if cached is not None:
        return cached

    ttl = 300 if period in ("1d", "5d") else 900  # shorter TTL for intraday

    try:
        ticker = yf.Ticker(symbol)
        hist = ticker.history(period=period)
        if hist.empty:
            return []

        hist.index = pd.to_datetime(hist.index)
        hist = add_technical_indicators(hist)
        hist = hist.dropna(subset=["Close"])

        records = []
        for date, row in hist.iterrows():
            records.append({
                "date": date.strftime("%Y-%m-%d"),
                "open": round(float(row["Open"]), 2),
                "high": round(float(row["High"]), 2),
                "low": round(float(row["Low"]), 2),
                "close": round(float(row["Close"]), 2),
                "volume": int(row["Volume"]),
                "ma20": round(float(row["ma20"]), 2) if pd.notna(row["ma20"]) else None,
                "ma50": round(float(row["ma50"]), 2) if pd.notna(row["ma50"]) else None,
                "ma200": round(float(row["ma200"]), 2) if pd.notna(row["ma200"]) else None,
                "ema20": round(float(row["ema20"]), 2) if pd.notna(row["ema20"]) else None,
                "rsi": round(float(row["rsi"]), 2) if pd.notna(row["rsi"]) else None,
                "macd": round(float(row["macd"]), 4) if pd.notna(row["macd"]) else None,
                "macd_signal": round(float(row["macd_signal"]), 4) if pd.notna(row["macd_signal"]) else None,
                "macd_hist": round(float(row["macd_hist"]), 4) if pd.notna(row["macd_hist"]) else None,
                "bb_upper": round(float(row["bb_upper"]), 2) if pd.notna(row["bb_upper"]) else None,
                "bb_mid": round(float(row["bb_mid"]), 2) if pd.notna(row["bb_mid"]) else None,
                "bb_lower": round(float(row["bb_lower"]), 2) if pd.notna(row["bb_lower"]) else None,
                "daily_return": round(float(row["daily_return"]), 4) if pd.notna(row["daily_return"]) else None,
                "volatility": round(float(row["volatility"]), 4) if pd.notna(row["volatility"]) else None,
                "atr": round(float(row["atr"]), 2) if pd.notna(row["atr"]) else None,
            })

        cache.set(cache_key, records, ttl=ttl)
        return records
    except Exception as e:
        logger.error(f"Error fetching history for {symbol}: {e}")
        return []


# ────────────────────────────────────────────────────────────
# Stock Info
# ────────────────────────────────────────────────────────────

def get_stock_info(symbol: str) -> Dict[str, Any]:
    cache_key = make_cache_key("info", symbol)
    cached = cache.get(cache_key)
    if cached is not None:
        return cached

    try:
        ticker = yf.Ticker(symbol)
        info = ticker.info
        hist = ticker.history(period="5d")

        current_price = float(hist["Close"].iloc[-1]) if not hist.empty else 0
        prev_price = float(hist["Close"].iloc[-2]) if len(hist) > 1 else current_price
        change = current_price - prev_price
        change_pct = ((change / prev_price) * 100) if prev_price else 0
        avg_volume = float(hist["Volume"].mean()) if not hist.empty else 0
        last_volume = int(hist["Volume"].iloc[-1]) if not hist.empty else 0
        volume_ratio = round(last_volume / avg_volume, 2) if avg_volume > 0 else 1.0

        result = {
            "symbol": symbol,
            "name": info.get("longName", info.get("shortName", symbol)),
            "sector": info.get("sector", "N/A"),
            "industry": info.get("industry", "N/A"),
            "market_cap": info.get("marketCap"),
            "current_price": round(current_price, 2),
            "previous_close": round(prev_price, 2),
            "change": round(change, 2),
            "change_percent": round(change_pct, 2),
            "volume": last_volume,
            "avg_volume": int(avg_volume),
            "volume_ratio": volume_ratio,
            "pe_ratio": info.get("trailingPE"),
            "forward_pe": info.get("forwardPE"),
            "peg_ratio": info.get("pegRatio"),
            "price_to_book": info.get("priceToBook"),
            "beta": info.get("beta"),
            "fifty_two_week_high": info.get("fiftyTwoWeekHigh"),
            "fifty_two_week_low": info.get("fiftyTwoWeekLow"),
            "fifty_two_week_range_pct": None,
            "dividend_yield": info.get("dividendYield"),
            "earnings_growth": info.get("earningsGrowth"),
            "revenue_growth": info.get("revenueGrowth"),
            "profit_margins": info.get("profitMargins"),
            "description": (info.get("longBusinessSummary", "") or "")[:500],
            "exchange": info.get("exchange", ""),
            "currency": info.get("currency", "USD"),
        }

        # 52-week range position (0–100%)
        wk_high = result["fifty_two_week_high"]
        wk_low = result["fifty_two_week_low"]
        if wk_high and wk_low and wk_high > wk_low:
            result["fifty_two_week_range_pct"] = round(
                (current_price - wk_low) / (wk_high - wk_low) * 100, 1
            )

        cache.set(cache_key, result, ttl=600)
        return result
    except Exception as e:
        logger.error(f"Error fetching info for {symbol}: {e}")
        return {
            "symbol": symbol, "name": symbol, "sector": "N/A",
            "current_price": 0, "change_percent": 0, "change": 0,
            "volume": 0, "volume_ratio": 1.0,
        }


# ────────────────────────────────────────────────────────────
# Market Overview (indices + trending + gainers/losers)
# ────────────────────────────────────────────────────────────

def get_market_overview() -> Dict[str, Any]:
    cache_key = make_cache_key("market_overview")
    cached = cache.get(cache_key)
    if cached is not None:
        return cached

    indices = []
    for idx in MARKET_INDICES:
        try:
            ticker = yf.Ticker(idx)
            hist = ticker.history(period="5d")
            if not hist.empty:
                current = float(hist["Close"].iloc[-1])
                prev = float(hist["Close"].iloc[-2]) if len(hist) > 1 else current
                change_pct = ((current - prev) / prev * 100) if prev else 0
                indices.append({
                    "symbol": idx,
                    "name": INDEX_NAMES.get(idx, idx),
                    "value": round(current, 2),
                    "change": round(current - prev, 2),
                    "change_percent": round(change_pct, 2),
                })
        except Exception as e:
            logger.warning(f"Could not fetch index {idx}: {e}")

    # Trending + gainers/losers from popular stocks
    trending = []
    for sym in POPULAR_STOCKS[:12]:
        try:
            info = get_stock_info(sym)
            trending.append(info)
        except Exception:
            pass

    trending_sorted = sorted(trending, key=lambda x: abs(x.get("change_percent", 0)), reverse=True)
    gainers = [s for s in trending if s.get("change_percent", 0) > 0]
    gainers.sort(key=lambda x: x.get("change_percent", 0), reverse=True)
    losers = [s for s in trending if s.get("change_percent", 0) < 0]
    losers.sort(key=lambda x: x.get("change_percent", 0))

    result = {
        "indices": indices,
        "trending": trending_sorted[:8],
        "top_gainers": gainers[:5],
        "top_losers": losers[:5],
        "market_status": "open",
    }

    cache.set(cache_key, result, ttl=180)  # 3 min cache for overview
    return result


# ────────────────────────────────────────────────────────────
# Sector Performance
# ────────────────────────────────────────────────────────────

def get_sector_performance() -> List[Dict[str, Any]]:
    cache_key = make_cache_key("sector_performance")
    cached = cache.get(cache_key)
    if cached is not None:
        return cached

    results = []
    for sector_name, etf in SECTOR_ETFS.items():
        try:
            ticker = yf.Ticker(etf)
            hist = ticker.history(period="5d")
            if not hist.empty and len(hist) >= 2:
                current = float(hist["Close"].iloc[-1])
                prev = float(hist["Close"].iloc[-2])
                change_pct = (current - prev) / prev * 100 if prev else 0
                # MTD (approx 20 trading days)
                start = float(hist["Close"].iloc[0]) if len(hist) > 1 else current
                # 5d return
                ret_5d = (current - start) / start * 100 if start else 0
                results.append({
                    "sector": sector_name,
                    "etf": etf,
                    "change_percent": round(change_pct, 2),
                    "return_5d": round(ret_5d, 2),
                    "price": round(current, 2),
                })
        except Exception as e:
            logger.warning(f"Sector ETF {etf} error: {e}")

    results.sort(key=lambda x: x["change_percent"], reverse=True)
    cache.set(cache_key, results, ttl=600)
    return results


# ────────────────────────────────────────────────────────────
# Multi-stock prices (for portfolio)
# ────────────────────────────────────────────────────────────

def get_multi_stock_prices(symbols: List[str], period: str = "1y") -> pd.DataFrame:
    cache_key = make_cache_key("multi_prices", sorted(symbols), period)
    cached = cache.get(cache_key)
    if cached is not None:
        return cached

    try:
        raw = yf.download(symbols, period=period, auto_adjust=True, progress=False)
        if len(symbols) == 1:
            close = raw[["Close"]].rename(columns={"Close": symbols[0]})
        else:
            close = raw["Close"]
        close = close.dropna()
        cache.set(cache_key, close, ttl=900)
        return close
    except Exception as e:
        logger.error(f"Error downloading multi-stock data: {e}")
        return pd.DataFrame()


# ────────────────────────────────────────────────────────────
# Stock Search
# ────────────────────────────────────────────────────────────

def search_stocks(query: str) -> List[Dict[str, Any]]:
    query = query.upper().strip()
    results = []

    # Check against popular stocks first (instant, no API call)
    for sym in POPULAR_STOCKS:
        if query in sym:
            results.append({"symbol": sym, "name": sym, "exchange": "US", "type": "EQUITY"})

    # Validate query as actual symbol
    if query not in [r["symbol"] for r in results]:
        try:
            ticker = yf.Ticker(query)
            info = ticker.info
            name = info.get("longName", info.get("shortName", query))
            if name and name != query:
                results.insert(0, {
                    "symbol": query,
                    "name": name,
                    "exchange": info.get("exchange", ""),
                    "type": info.get("quoteType", "EQUITY"),
                })
        except Exception:
            pass

    return results[:10]
