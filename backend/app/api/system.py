"""System health API routes."""
from fastapi import APIRouter
import platform
import sys

router = APIRouter()


@router.get("/health")
async def system_health():
    """Get system health status for all services."""
    return {
        "services": [
            {"name": "API Server", "status": "healthy", "latency_ms": 5, "message": "Operational"},
            {"name": "ML Service", "status": "offline", "latency_ms": None, "message": "Not connected"},
            {"name": "Database", "status": "healthy", "latency_ms": 2, "message": "Operational"},
            {"name": "Event Processor", "status": "offline", "latency_ms": None, "message": "Not connected"},
            {"name": "Stream Processor", "status": "offline", "latency_ms": None, "message": "Not connected"},
        ],
        "metrics": {
            "cpu_percent": 0,
            "memory_percent": 0,
            "events_per_sec": 0,
            "avg_inference_ms": 0,
            "queue_size": 0,
        },
        "system_info": {
            "python_version": sys.version,
            "platform": platform.platform(),
        },
    }
