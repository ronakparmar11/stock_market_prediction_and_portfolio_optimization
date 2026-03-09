from fastapi import APIRouter, HTTPException
from services.ml_service import run_prediction
from models.schemas import PredictionRequest

router = APIRouter(prefix="/api/predictions", tags=["predictions"])


@router.post("/")
async def predict(req: PredictionRequest):
    try:
        result = run_prediction(
            symbol=req.symbol.upper(),
            period=req.period,
            forecast_days=req.forecast_days,
            model_name=req.model,
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{symbol}")
async def predict_get(symbol: str, period: str = "2y", forecast_days: int = 30, model: str = "random_forest"):
    try:
        result = run_prediction(
            symbol=symbol.upper(),
            period=period,
            forecast_days=forecast_days,
            model_name=model,
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
