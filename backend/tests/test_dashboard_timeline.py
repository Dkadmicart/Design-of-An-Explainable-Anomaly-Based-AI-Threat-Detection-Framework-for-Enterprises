"""
SentinelAI - Tests for Dashboard Threat Activity Timeline API
Validates authentic replay event aggregation, categorization rules, time bucketing,
timezone-aware UTC serialization, empty state handling, and replay lifecycle status.
"""
import uuid
import pytest
from datetime import datetime, timedelta, timezone
from fastapi.testclient import TestClient
from sqlalchemy import select, delete

from app.main import app
from app.database.session import async_session
from app.models.database import Event
from app.services.replay_loader import get_replay_loader_service


@pytest.fixture(scope="module")
def client():
    return TestClient(app)


def test_dashboard_timeline_categorization_and_aggregation(client):
    """Verify that actual replay events are categorized into normal/suspicious/critical and aggregated into buckets."""
    async def _setup_events():
        base_time = datetime.now(timezone.utc) - timedelta(minutes=10)
        # Create 10 deterministic test events across 3 buckets
        # Bucket 0: t = 0 min
        # Bucket 1: t = 2 min (empty - should be filled with 0s)
        # Bucket 2: t = 4 min
        test_events = [
            # Bucket 0: 2 Normal (risk 5.0, 12.0), 1 Suspicious (risk 60.0), 1 Critical (risk 85.0)
            Event(
                id=str(uuid.uuid4()),
                source_ip="192.168.1.10",
                destination_ip="192.168.1.50",
                prediction="BENIGN",
                attack_type="BENIGN",
                risk_score=5.0,
                timestamp=(base_time).replace(tzinfo=None),
            ),
            Event(
                id=str(uuid.uuid4()),
                source_ip="192.168.1.11",
                destination_ip="192.168.1.50",
                prediction="BENIGN",
                attack_type="BENIGN",
                risk_score=12.0,
                timestamp=(base_time + timedelta(seconds=10)).replace(tzinfo=None),
            ),
            Event(
                id=str(uuid.uuid4()),
                source_ip="172.16.0.5",
                destination_ip="192.168.1.50",
                prediction="ATTACK",
                attack_type="DoS",
                risk_score=60.0,
                timestamp=(base_time + timedelta(seconds=20)).replace(tzinfo=None),
            ),
            Event(
                id=str(uuid.uuid4()),
                source_ip="172.16.0.6",
                destination_ip="192.168.1.50",
                prediction="ATTACK",
                attack_type="DDoS",
                risk_score=85.0,
                timestamp=(base_time + timedelta(seconds=30)).replace(tzinfo=None),
            ),
            # Bucket 2: 1 Normal (risk 8.0), 1 Critical (risk 78.0) at t = +4 min
            Event(
                id=str(uuid.uuid4()),
                source_ip="192.168.1.12",
                destination_ip="192.168.1.50",
                prediction="BENIGN",
                attack_type="BENIGN",
                risk_score=8.0,
                timestamp=(base_time + timedelta(minutes=4)).replace(tzinfo=None),
            ),
            Event(
                id=str(uuid.uuid4()),
                source_ip="172.16.0.7",
                destination_ip="192.168.1.50",
                prediction="ATTACK",
                attack_type="DDoS",
                risk_score=78.0,
                timestamp=(base_time + timedelta(minutes=4, seconds=15)).replace(tzinfo=None),
            ),
        ]
        test_ids = [e.id for e in test_events]
        async with async_session() as s:
            for e in test_events:
                s.add(e)
            await s.commit()
        return test_ids

    import asyncio
    test_ids = asyncio.run(_setup_events())

    try:
        # Request timeline with 1-minute (60s) buckets
        res = client.get("/api/dashboard/timeline?window_hours=1&bucket_seconds=60")
        assert res.status_code == 200
        data = res.json()

        assert "timeline" in data
        assert data["total_events"] >= 6
        assert data["bucket_seconds"] == 60
        assert data["window_hours"] == 1.0

        # Categorization sums check
        assert data["normal_events"] + data["suspicious_events"] + data["critical_events"] == data["total_events"]
        assert data["normal_events"] >= 3
        assert data["suspicious_events"] >= 1
        assert data["critical_events"] >= 2

        # Verify time points structure and explicit UTC timezone serialization
        points = data["timeline"]
        assert len(points) >= 3
        for pt in points:
            assert "time" in pt
            assert "timestamp" in pt
            assert pt["timestamp"].endswith("Z") or "+00:00" in pt["timestamp"]
            assert "normal" in pt
            assert "suspicious" in pt
            assert "critical" in pt
            assert "total" in pt
            assert pt["normal"] + pt["suspicious"] + pt["critical"] == pt["total"]

        # Verify chronological ordering
        for i in range(len(points) - 1):
            assert points[i]["epoch"] < points[i + 1]["epoch"]

    finally:
        # Clean up inserted test events
        async def _cleanup():
            async with async_session() as s:
                await s.execute(delete(Event).where(Event.id.in_(test_ids)))
                await s.commit()
        asyncio.run(_cleanup())


def test_dashboard_timeline_empty_state(client):
    """Verify that an empty window honestly returns an empty timeline without mock data."""
    # Query with a very short window (0.1 hours = 6 minutes) into a future or past offset
    # or query with window_hours=0.1 when no events exist in that specific window
    res = client.get("/api/dashboard/timeline?window_hours=0.0001")
    assert res.status_code == 200
    data = res.json()

    assert data["timeline"] == []
    assert data["total_events"] == 0
    assert data["normal_events"] == 0
    assert data["suspicious_events"] == 0
    assert data["critical_events"] == 0


def test_dashboard_timeline_replay_lifecycle_reflection(client):
    """Verify that timeline endpoint reflects replay loader service running/paused status."""
    service = get_replay_loader_service()

    # Initial state
    res = client.get("/api/dashboard/timeline")
    assert res.status_code == 200
    data = res.json()
    assert data["is_replay_running"] == service.is_running
    assert data["is_replay_paused"] == service.is_paused

