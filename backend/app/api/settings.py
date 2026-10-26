"""Settings API routes."""
from fastapi import APIRouter
from app.schemas import SettingsUpdate

router = APIRouter()


@router.get("")
async def get_settings():
    """Get current platform settings."""
    return {
        "detection_mode": "binary",
        "alert_threshold": 50.0,
        "replay_speed": 1.0,
        "notifications_enabled": True,
        "selected_model": "Random Forest",
        "selected_dataset": "CIC-IDS2017",
    }


@router.put("")
async def update_settings(settings: SettingsUpdate):
    """Update platform settings."""
    return {"status": "updated", "settings": settings.model_dump(exclude_none=True)}
