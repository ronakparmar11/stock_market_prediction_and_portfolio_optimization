from fastapi import APIRouter, HTTPException
from services.portfolio_service import optimize_portfolio
from models.schemas import PortfolioRequest

router = APIRouter(prefix="/api/portfolio", tags=["portfolio"])


@router.post("/optimize")
async def portfolio_optimize(req: PortfolioRequest):
    try:
        if len(req.symbols) < 2:
            raise HTTPException(status_code=400, detail="Please provide at least 2 stock symbols.")
        if len(req.symbols) > 15:
            raise HTTPException(status_code=400, detail="Maximum 15 stocks supported.")
        result = optimize_portfolio(
            symbols=[s.upper() for s in req.symbols],
            period=req.period,
            num_portfolios=req.num_portfolios,
        )
        return result
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
