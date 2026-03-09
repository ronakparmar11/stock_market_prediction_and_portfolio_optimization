from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import stocks, predictions, portfolio, ai
from services.cache_service import cache
import logging

logging.basicConfig(level=logging.INFO)

app = FastAPI(
    title="AlphaQuant — AI Financial Analytics API",
    description="AI-powered stock prediction, portfolio optimization, and financial analytics platform.",
    version="2.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(stocks.router)
app.include_router(predictions.router)
app.include_router(portfolio.router)
app.include_router(ai.router)


@app.get("/")
async def root():
    return {
        "app": "AlphaQuant Financial Analytics API",
        "version": "2.0.0",
        "docs": "/docs",
        "features": ["stock-analysis", "ml-predictions", "portfolio-optimization", "ai-insights"],
    }


@app.get("/health")
async def health():
    return {"status": "ok", "cache": cache.stats()}


@app.delete("/cache")
async def clear_cache():
    cache.clear()
    return {"message": "Cache cleared"}
