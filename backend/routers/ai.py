"""
AI Chatbot router — supports streaming (SSE) and regular chat completions.
Uses Featherless AI (Llama 3.1) with a built-in financial knowledge fallback.
"""
from fastapi import APIRouter
from fastapi.responses import StreamingResponse, JSONResponse
from pydantic import BaseModel
from typing import List, Optional
from services.ai_service import (
    analyze_stock, analyze_portfolio, analyze_prediction,
    get_market_summary, chat_stream,
)
import json
import logging

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/ai", tags=["ai"])

CHAT_SYSTEM = """You are AlphaBot, an expert AI financial analyst embedded in AlphaQuant — a professional stock market analytics platform.

You specialize in:
- Technical analysis (RSI, MACD, Bollinger Bands, Moving Averages, candlestick patterns)
- Fundamental analysis (P/E ratio, P/B, PEG, market cap, earnings growth)
- ML prediction interpretation (R² score, MAE, RMSE, feature importance)
- Portfolio optimization (Modern Portfolio Theory, Sharpe ratio, efficient frontier, correlation)
- Market dynamics (sector rotation, volatility regimes, macro trends)
- Risk management (Beta, ATR, position sizing, diversification)

Always be:
- Direct and data-driven
- Concise (2-5 sentences unless detail is requested)
- Professional and measured about forward-looking statements
- Educational when explaining concepts

Format responses with **bold** for key terms and bullet points for lists.
Add a brief disclaimer for any investment-related suggestions."""


# ── Chat message model ─────────────────────────────────────────────

class ChatMessage(BaseModel):
    role: str  # "user" or "assistant"
    content: str


class ChatRequest(BaseModel):
    messages: List[ChatMessage]
    stream: bool = False


# ── Streaming endpoint ─────────────────────────────────────────────

@router.post("/chat/stream")
async def chat_stream_endpoint(req: ChatRequest):
    """SSE streaming chat. Frontend consumes with fetch + ReadableStream."""
    messages = [{"role": "system", "content": CHAT_SYSTEM}]
    messages += [{"role": m.role, "content": m.content} for m in req.messages]

    async def event_generator():
        try:
            async for token in chat_stream(messages):
                # SSE format: data: <payload>\n\n
                payload = json.dumps({"token": token})
                yield f"data: {payload}\n\n"
            yield "data: [DONE]\n\n"
        except Exception as e:
            logger.error(f"Chat stream error: {e}")
            yield f"data: {json.dumps({'error': str(e)})}\n\n"
            yield "data: [DONE]\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


# ── Non-streaming fallback ─────────────────────────────────────────

@router.post("/chat/message")
async def chat_message(req: ChatRequest):
    """Non-streaming chat for simple queries."""
    messages = [{"role": "system", "content": CHAT_SYSTEM}]
    messages += [{"role": m.role, "content": m.content} for m in req.messages]

    full_response = ""
    try:
        async for token in chat_stream(messages):
            full_response += token
        return {"response": full_response.strip()}
    except Exception as e:
        logger.error(f"Chat error: {e}")
        return JSONResponse(status_code=500, content={"error": str(e)})


# ── Insight endpoints ──────────────────────────────────────────────

class StockInsightRequest(BaseModel):
    symbol: str
    name: str = ""
    sector: str = "Unknown"
    current_price: float
    change_percent: float
    rsi: Optional[float] = None
    ma50: Optional[float] = None
    ma200: Optional[float] = None
    volume_ratio: Optional[float] = None
    pe_ratio: Optional[float] = None


class PortfolioInsightRequest(BaseModel):
    symbols: List[str]
    weights: dict
    expected_return: float
    volatility: float
    sharpe_ratio: float


class PredictionInsightRequest(BaseModel):
    symbol: str
    model: str
    accuracy: float
    r2: float
    mae: float
    last_price: float
    forecast_30d: float


class MarketInsightRequest(BaseModel):
    indices: list
    top_gainers: list
    top_losers: list


@router.post("/stock-insight")
async def stock_insight(req: StockInsightRequest):
    insight = await analyze_stock(
        symbol=req.symbol.upper(), name=req.name or req.symbol, sector=req.sector,
        current_price=req.current_price, change_pct=req.change_percent,
        rsi=req.rsi, ma50=req.ma50, ma200=req.ma200,
        volume_ratio=req.volume_ratio, pe_ratio=req.pe_ratio,
    )
    return {"insight": insight, "symbol": req.symbol.upper()}


@router.post("/portfolio-insight")
async def portfolio_insight(req: PortfolioInsightRequest):
    insight = await analyze_portfolio(
        symbols=req.symbols, weights=req.weights,
        expected_return=req.expected_return, volatility=req.volatility,
        sharpe_ratio=req.sharpe_ratio,
    )
    return {"insight": insight}


@router.post("/prediction-insight")
async def prediction_insight(req: PredictionInsightRequest):
    insight = await analyze_prediction(
        symbol=req.symbol.upper(), model=req.model, accuracy=req.accuracy,
        r2=req.r2, mae=req.mae, last_price=req.last_price, forecast_30d=req.forecast_30d,
    )
    return {"insight": insight, "symbol": req.symbol.upper()}


@router.post("/market-summary")
async def market_summary(req: MarketInsightRequest):
    insight = await get_market_summary(
        indices=req.indices, top_gainers=req.top_gainers, top_losers=req.top_losers,
    )
    return {"insight": insight}
