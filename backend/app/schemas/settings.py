"""Pydantic schemas for System Settings."""
from typing import Optional
from pydantic import BaseModel, Field


class SettingsUpdate(BaseModel):
    """Settings update request."""
    detection_mode: Optional[str] = Field(None, description="Detection mode: 'binary'")
    alert_threshold: Optional[float] = Field(None, ge=0.0, le=100.0, description="Risk threshold for alert generation")
    replay_speed: Optional[float] = Field(None, ge=0.1, le=10.0, description="Replay ingestion speed factor")
    notifications_enabled: Optional[bool] = Field(None, description="Enable notification alerts")
    selected_model: Optional[str] = Field(None, description="Active registered detection model")
    selected_dataset: Optional[str] = Field(None, description="Active benchmark dataset")


class SettingsResponse(BaseModel):
    """Platform settings response schema."""
    detection_mode: str
    alert_threshold: float
    replay_speed: float
    notifications_enabled: bool
    selected_model: str
    selected_dataset: str
    updated_at: Optional[str] = None
