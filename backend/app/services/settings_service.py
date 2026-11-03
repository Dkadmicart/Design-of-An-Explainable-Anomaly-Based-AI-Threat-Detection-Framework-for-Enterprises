"""
SentinelAI - Settings Service
Manages persistence and runtime synchronization of platform preferences,
alert thresholds, and active detection model bindings.
"""
import logging
from datetime import datetime
from typing import Dict, Any, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from fastapi import HTTPException

from app.models.database import PlatformSetting
from app.schemas.settings import SettingsUpdate
from app.ml.xgboost_detector import get_xgboost_detector

logger = logging.getLogger("sentinelai.settings")

# In-memory synchronized runtime cache
_cached_alert_threshold: float = 50.0
_cached_detection_mode: str = "binary"
_cached_selected_model: str = "XGBoost Grouped Classifier"
_cached_selected_dataset: str = "CIC-IDS2017 Benchmark"


def get_active_alert_threshold() -> float:
    """Return current in-memory active alert threshold for fast access."""
    return _cached_alert_threshold


def get_active_detection_mode() -> str:
    """Return current in-memory active detection mode."""
    return _cached_detection_mode


def get_active_selected_model() -> str:
    """Return current in-memory active selected model."""
    return _cached_selected_model


def get_active_selected_dataset() -> str:
    """Return current in-memory active selected dataset."""
    return _cached_selected_dataset


def set_active_alert_threshold(threshold: float) -> None:
    """Update in-memory active threshold."""
    global _cached_alert_threshold
    _cached_alert_threshold = float(threshold)


async def get_or_create_settings(db: AsyncSession) -> PlatformSetting:
    """Fetch the singleton platform settings record, creating it if not present."""
    global _cached_alert_threshold, _cached_detection_mode, _cached_selected_model, _cached_selected_dataset

    res = await db.execute(select(PlatformSetting).where(PlatformSetting.id == "default"))
    settings_record = res.scalar_one_or_none()

    if settings_record is None:
        detector = get_xgboost_detector()
        model_name = detector.model_name  # "XGBoost Grouped Classifier"
        settings_record = PlatformSetting(
            id="default",
            detection_mode="binary",
            alert_threshold=50.0,
            replay_speed=1.0,
            notifications_enabled=True,
            selected_model=model_name,
            selected_dataset="CIC-IDS2017 Benchmark",
        )
        db.add(settings_record)
        await db.commit()
        await db.refresh(settings_record)

    # Sync cache
    _cached_alert_threshold = float(settings_record.alert_threshold)
    _cached_detection_mode = settings_record.detection_mode
    _cached_selected_model = settings_record.selected_model
    _cached_selected_dataset = settings_record.selected_dataset

    return settings_record


async def update_settings(db: AsyncSession, payload: SettingsUpdate) -> PlatformSetting:
    """Validate and persist platform settings updates."""
    global _cached_alert_threshold, _cached_detection_mode, _cached_selected_model, _cached_selected_dataset

    # 1. Validation: Multiclass detection mode is unavailable
    if payload.detection_mode is not None:
        mode_val = payload.detection_mode.strip().lower()
        if mode_val == "multiclass":
            raise HTTPException(
                status_code=400,
                detail="Multiclass detection mode is unavailable: no multiclass model is configured in the registry."
            )
        elif mode_val != "binary":
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported detection mode '{payload.detection_mode}'. Only 'binary' mode is supported."
            )

    # 2. Validation: Alert threshold bounds
    if payload.alert_threshold is not None:
        if not (0.0 <= payload.alert_threshold <= 100.0):
            raise HTTPException(
                status_code=400,
                detail=f"Alert threshold must be between 0.0 and 100.0 (received {payload.alert_threshold})."
            )

    # 3. Validation: Selected model
    if payload.selected_model is not None:
        detector = get_xgboost_detector()
        allowed_names = [
            detector.model_name.lower(),
            detector.get_info()["id"].lower(),
            "xgboost classifier",
            "xgboost grouped classifier",
            "xgboost",
        ]
        if payload.selected_model.strip().lower() not in allowed_names:
            raise HTTPException(
                status_code=400,
                detail=(
                    f"Model '{payload.selected_model}' is not a registered active model. "
                    f"Only the trained '{detector.model_name}' is available."
                )
            )

    # 4. Validation: Selected dataset
    if payload.selected_dataset is not None:
        allowed_datasets = [
            "cic-ids2017 benchmark",
            "historical cic-ids2017 benchmark (dataset replay)",
            "cic-ids2017",
            "cicids2017",
        ]
        if payload.selected_dataset.strip().lower() not in allowed_datasets:
            raise HTTPException(
                status_code=400,
                detail=(
                    f"Dataset '{payload.selected_dataset}' is not a registered dataset benchmark. "
                    "Only 'CIC-IDS2017 Benchmark' is supported."
                )
            )

    # 5. Fetch existing and update
    record = await get_or_create_settings(db)

    if payload.detection_mode is not None:
        record.detection_mode = payload.detection_mode.strip().lower()
    if payload.alert_threshold is not None:
        record.alert_threshold = float(payload.alert_threshold)
    if payload.replay_speed is not None:
        record.replay_speed = max(0.1, min(10.0, float(payload.replay_speed)))
    if payload.notifications_enabled is not None:
        record.notifications_enabled = bool(payload.notifications_enabled)
    if payload.selected_model is not None:
        detector = get_xgboost_detector()
        record.selected_model = detector.model_name
    if payload.selected_dataset is not None:
        record.selected_dataset = payload.selected_dataset.strip()

    await db.commit()
    await db.refresh(record)

    # Sync cache
    _cached_alert_threshold = float(record.alert_threshold)
    _cached_detection_mode = record.detection_mode
    _cached_selected_model = record.selected_model
    _cached_selected_dataset = record.selected_dataset

    logger.info(
        "Platform settings updated: mode=%s, threshold=%.1f, model=%s, dataset=%s",
        record.detection_mode, record.alert_threshold, record.selected_model, record.selected_dataset
    )
    return record

