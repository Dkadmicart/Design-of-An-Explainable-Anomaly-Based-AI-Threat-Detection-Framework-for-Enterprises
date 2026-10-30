"""
SentinelAI - Dataset Replay Engine API Endpoints
Connects real-time network flow replay to dataset pipeline and XGBoost detection engine.
"""
import logging
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.database.session import get_db
from app.schemas import ReplayConfig
from app.services.replay_loader import get_replay_loader_service

logger = logging.getLogger("sentinelai.api.replay")
router = APIRouter()


@router.post("/start")
async def start_replay(config: ReplayConfig, db: AsyncSession = Depends(get_db)):
    """Start or resume dataset replay ingestion into event detection pipeline."""
    service = get_replay_loader_service()
    batch_size = config.batch_size if config.batch_size is not None else 100

    try:
        res = await service.start_replay(
            db=db,
            batch_size=batch_size,
            speed=config.speed,
            dataset_file=config.dataset_file,
            loop=config.loop or False,
        )
        return res
    except ValueError as err:
        logger.warning("Invalid replay configuration: %s", err)
        raise HTTPException(status_code=422, detail=str(err))
    except FileNotFoundError as err:
        logger.warning("Replay dataset source not found: %s", err)
        raise HTTPException(status_code=404, detail=str(err))
    except Exception as exc:
        logger.exception("Replay execution failed: %s", exc)
        raise HTTPException(status_code=500, detail=f"Replay processing error: {str(exc)}")


@router.post("/step")
async def step_replay(
    count: int = 5,
    db: AsyncSession = Depends(get_db),
):
    """Step active dataset replay by ingesting the next count flow records."""
    service = get_replay_loader_service()
    try:
        return await service.step(db=db, count=count)
    except Exception as exc:
        logger.exception("Replay step execution failed: %s", exc)
        raise HTTPException(status_code=500, detail=f"Replay step error: {str(exc)}")


@router.post("/pause")
async def pause_replay():
    """Pause active dataset replay."""
    service = get_replay_loader_service()
    return service.pause()


@router.post("/resume")
async def resume_replay():
    """Resume paused dataset replay."""
    service = get_replay_loader_service()
    return service.resume()


@router.post("/stop")
async def stop_replay():
    """Stop active dataset replay, cancel background worker, and reset active stream pointer."""
    service = get_replay_loader_service()
    return await service.stop()


@router.get("/status")
async def replay_status():
    """Get current runtime status of dataset replay engine."""
    service = get_replay_loader_service()
    return service.get_status()
