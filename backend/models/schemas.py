from pydantic import BaseModel
from typing import List, Optional, Dict, Any


class StockRequest(BaseModel):
    symbol: str
    period: str = "1y"  # 1mo, 3mo, 6mo, 1y, 2y, 5y


class PortfolioRequest(BaseModel):
    symbols: List[str]
    period: str = "1y"
    num_portfolios: int = 5000


class PredictionRequest(BaseModel):
    symbol: str
    period: str = "2y"
    forecast_days: int = 30
    model: str = "random_forest"  # linear, random_forest, gradient_boosting, svr


class StockDataPoint(BaseModel):
    date: str
    open: float
    high: float
    low: float
    close: float
    volume: float
    ma50: Optional[float] = None
    ma200: Optional[float] = None
    rsi: Optional[float] = None
    macd: Optional[float] = None
    macd_signal: Optional[float] = None
    daily_return: Optional[float] = None
    volatility: Optional[float] = None


class StockInfo(BaseModel):
    symbol: str
    name: str
    sector: str
    market_cap: Optional[float] = None
    current_price: float
    change_percent: float
    volume: float


class PredictionResult(BaseModel):
    symbol: str
    model: str
    predictions: List[Dict[str, Any]]
    metrics: Dict[str, float]
    feature_importance: Optional[Dict[str, float]] = None
    historical: List[Dict[str, Any]]


class PortfolioResult(BaseModel):
    symbols: List[str]
    optimal_weights: Dict[str, float]
    expected_return: float
    volatility: float
    sharpe_ratio: float
    efficient_frontier: List[Dict[str, float]]
    correlation_matrix: Dict[str, Dict[str, float]]
    individual_stats: Dict[str, Dict[str, float]]


class MarketOverview(BaseModel):
    indices: List[Dict[str, Any]]
    trending: List[Dict[str, Any]]
    market_status: str
