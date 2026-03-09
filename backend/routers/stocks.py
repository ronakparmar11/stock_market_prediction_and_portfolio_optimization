from fastapi import APIRouter, HTTPException, Query
from services.data_service import (
    get_stock_history, get_stock_info,
    get_market_overview, search_stocks,
    get_sector_performance,
)

router = APIRouter(prefix="/api/stocks", tags=["stocks"])


@router.get("/market-overview")
async def market_overview():
    try:
        return get_market_overview()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/sector-performance")
async def sector_performance():
    try:
        return {"sectors": get_sector_performance()}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/search")
async def search(q: str = Query(..., min_length=1)):
    results = search_stocks(q)
    return {"results": results}


@router.get("/{symbol}/info")
async def stock_info(symbol: str):
    try:
        data = get_stock_info(symbol.upper())
        if not data:
            raise HTTPException(status_code=404, detail=f"Stock {symbol} not found")
        return data
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{symbol}/history")
async def stock_history(symbol: str, period: str = Query("1y")):
    try:
        data = get_stock_history(symbol.upper(), period)
        if not data:
            raise HTTPException(status_code=404, detail=f"No data found for {symbol}")
        return {"symbol": symbol.upper(), "period": period, "data": data}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
