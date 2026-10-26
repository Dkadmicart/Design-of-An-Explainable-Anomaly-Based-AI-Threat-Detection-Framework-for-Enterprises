"""Dataset Replay Engine API routes."""
from fastapi import APIRouter
from app.schemas import ReplayConfig

router = APIRouter()


@router.post("/start")
async def start_replay(config: ReplayConfig):
    """Start dataset replay streaming."""
    return {
        "status": "started",
        "speed": config.speed,
        "message": "Replay engine not yet connected to dataset pipeline",
    }


@router.post("/pause")
async def pause_replay():
    """Pause dataset replay."""
    return {"status": "paused"}


@router.post("/stop")
async def stop_replay():
    """Stop dataset replay."""
    return {"status": "stopped"}


@router.get("/status")
async def replay_status():
    """Get current replay status."""
    return {
        "is_running": False,
        "is_paused": False,
        "speed": 1.0,
        "events_sent": 0,
        "total_events": 0,
        "current_file": None,
        "elapsed_seconds": 0,
    }
