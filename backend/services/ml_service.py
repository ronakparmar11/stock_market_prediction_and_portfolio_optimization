import numpy as np
import pandas as pd
from typing import Dict, Any, List, Tuple
from sklearn.linear_model import LinearRegression
from sklearn.ensemble import RandomForestRegressor, GradientBoostingRegressor
from sklearn.svm import SVR
from sklearn.preprocessing import StandardScaler, MinMaxScaler
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
import logging

from services.data_service import get_stock_history, add_technical_indicators
import yfinance as yf

logger = logging.getLogger(__name__)

MODELS = {
    "linear": LinearRegression(),
    "random_forest": RandomForestRegressor(n_estimators=100, random_state=42, n_jobs=-1),
    "gradient_boosting": GradientBoostingRegressor(n_estimators=100, random_state=42),
    "svr": SVR(kernel="rbf", C=100, gamma=0.1, epsilon=0.1),
}

FEATURE_COLS = [
    "open", "high", "low", "volume_norm",
    "ma20", "ma50", "rsi", "macd", "macd_signal",
    "daily_return", "volatility", "momentum_5", "momentum_10",
    "lag1", "lag2", "lag3", "lag5", "lag10",
]


def prepare_features(df: pd.DataFrame) -> Tuple[pd.DataFrame, pd.Series]:
    """Engineer features and return X, y for ML."""
    df = df.copy()
    close = df["Close"]

    # Technical indicators
    df["ma20"] = close.rolling(20).mean()
    df["ma50"] = close.rolling(50).mean()
    df["rsi"] = _compute_rsi(close)
    ema12 = close.ewm(span=12, adjust=False).mean()
    ema26 = close.ewm(span=26, adjust=False).mean()
    df["macd"] = ema12 - ema26
    df["macd_signal"] = df["macd"].ewm(span=9, adjust=False).mean()
    df["daily_return"] = close.pct_change() * 100
    df["volatility"] = df["daily_return"].rolling(20).std()
    df["momentum_5"] = close.pct_change(5) * 100
    df["momentum_10"] = close.pct_change(10) * 100

    # Volume normalization
    df["volume_norm"] = df["Volume"] / df["Volume"].rolling(20).mean()

    # Lag features (past close prices)
    for lag in [1, 2, 3, 5, 10]:
        df[f"lag{lag}"] = close.shift(lag)

    # Lowercase column names for features
    df["open"] = df["Open"]
    df["high"] = df["High"]
    df["low"] = df["Low"]

    # Target: next day close
    df["target"] = close.shift(-1)

    df = df.dropna()

    X = df[FEATURE_COLS]
    y = df["target"]
    return X, y, df


def _compute_rsi(series: pd.Series, period: int = 14) -> pd.Series:
    delta = series.diff()
    gain = delta.clip(lower=0)
    loss = -delta.clip(upper=0)
    avg_gain = gain.ewm(com=period - 1, min_periods=period).mean()
    avg_loss = loss.ewm(com=period - 1, min_periods=period).mean()
    rs = avg_gain / avg_loss
    return 100 - (100 / (1 + rs))


def run_prediction(symbol: str, period: str = "2y", forecast_days: int = 30, model_name: str = "random_forest") -> Dict[str, Any]:
    try:
        ticker = yf.Ticker(symbol)
        hist = ticker.history(period=period)
        if hist.empty or len(hist) < 60:
            raise ValueError(f"Not enough data for {symbol}")

        X, y, enriched_df = prepare_features(hist)

        # Train/test split (80/20 in time order)
        split_idx = int(len(X) * 0.8)
        X_train, X_test = X.iloc[:split_idx], X.iloc[split_idx:]
        y_train, y_test = y.iloc[:split_idx], y.iloc[split_idx:]

        # Scale features
        scaler = StandardScaler()
        X_train_sc = scaler.fit_transform(X_train)
        X_test_sc = scaler.transform(X_test)

        # Fit model
        from sklearn.base import clone
        model = clone(MODELS[model_name])
        model.fit(X_train_sc, y_train)

        # Evaluate
        y_pred_test = model.predict(X_test_sc)
        mae = float(mean_absolute_error(y_test, y_pred_test))
        mse = float(mean_squared_error(y_test, y_pred_test))
        rmse = float(np.sqrt(mse))
        r2 = float(r2_score(y_test, y_pred_test))

        # Historical predictions (test period only)
        test_dates = X_test.index
        historical_preds = []
        for i, (date, actual, predicted) in enumerate(zip(test_dates, y_test.values, y_pred_test)):
            historical_preds.append({
                "date": str(date.date()) if hasattr(date, "date") else str(date)[:10],
                "actual": round(float(actual), 2),
                "predicted": round(float(predicted), 2),
            })

        # Future forecast using last known features
        future_preds = []
        last_features = X.iloc[-1:].copy()
        last_close = float(hist["Close"].iloc[-1])

        from datetime import datetime, timedelta
        last_date = hist.index[-1]
        if hasattr(last_date, "date"):
            last_date = last_date.date()

        current_close = last_close
        for day in range(1, forecast_days + 1):
            future_date = last_date + timedelta(days=day)
            # Skip weekends
            while future_date.weekday() >= 5:
                day += 1
                future_date = last_date + timedelta(days=day)

            lf_sc = scaler.transform(last_features)
            pred_price = float(model.predict(lf_sc)[0])

            future_preds.append({
                "date": str(future_date),
                "predicted": round(pred_price, 2),
                "is_future": True,
            })

            # Roll features forward (simplified)
            new_features = last_features.copy()
            new_features["lag10"] = new_features["lag5"]
            new_features["lag5"] = new_features["lag3"]
            new_features["lag3"] = new_features["lag2"]
            new_features["lag2"] = new_features["lag1"]
            new_features["lag1"] = current_close
            new_features["daily_return"] = ((pred_price - current_close) / current_close) * 100
            current_close = pred_price
            last_features = new_features

        # Feature importances (for tree models)
        feature_importance = {}
        if hasattr(model, "feature_importances_"):
            importances = model.feature_importances_
            for feat, imp in zip(FEATURE_COLS, importances):
                feature_importance[feat] = round(float(imp), 4)
            feature_importance = dict(sorted(feature_importance.items(), key=lambda x: x[1], reverse=True)[:10])

        return {
            "symbol": symbol,
            "model": model_name,
            "predictions": future_preds,
            "historical_predictions": historical_preds,
            "metrics": {
                "mae": round(mae, 4),
                "mse": round(mse, 4),
                "rmse": round(rmse, 4),
                "r2_score": round(r2, 4),
                "accuracy_pct": round(max(0, (1 - mae / float(y_test.mean())) * 100), 2),
            },
            "feature_importance": feature_importance,
            "last_known_price": round(last_close, 2),
        }
    except Exception as e:
        logger.error(f"Prediction error for {symbol}: {e}")
        raise
