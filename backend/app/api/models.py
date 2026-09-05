"""Models API routes."""
from fastapi import APIRouter

router = APIRouter()


@router.get("")
async def list_models():
    """List all registered ML models."""
    return {"models": []}


@router.get("/{model_id}")
async def get_model(model_id: str):
    """Get model details."""
    return {"model": None}


@router.get("/{model_id}/metrics")
async def get_model_metrics(model_id: str):
    """Get model evaluation metrics."""
    return {"metrics": [], "message": "No metrics recorded yet"}
