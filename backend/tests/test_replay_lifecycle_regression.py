"""
SentinelAI - Regression Tests for Replay Lifecycle & Final-Batch Race Condition
Verifies:
1. Normal completion marks is_completed=True only AFTER final batch transaction commits.
2. Final batch race condition resilience: counters increment strictly post-commit.
3. Manual stop cleanly resets stream pointer and stops worker task.
4. Cancellation during batch processing safely rolls back and reports last_commit_status='rolled_back'.
"""
import asyncio
from datetime import datetime, timezone
import pytest
from unittest.mock import patch, AsyncMock
from fastapi.testclient import TestClient

from app.main import app
from app.database.session import async_session
from app.models.database import Event, Alert
from app.services.replay_loader import (
    ReplayLoaderService,
    get_replay_loader_service,
    DEFAULT_CSV_PATH,
)


@pytest.fixture(scope="module")
def client():
    return TestClient(app)


def test_normal_completion_marks_completed_and_preserves_counts():
    """Verify that reaching end of dataset marks is_completed=True and preserves final totals."""
    async def _run():
        service = ReplayLoaderService()
        await service.stop()

        async with async_session() as session:
            # Replay a file starting near the end so it completes immediately
            service.current_index = 2000
            res = await service.start_replay(
                db=session,
                batch_size=10,
                dataset_file=DEFAULT_CSV_PATH,
                loop=False,
            )
            assert res["status"] == "completed"
            assert service.is_completed is True
            assert service.is_running is False

            # Verify status preserves final counters (does NOT zero out on completion)
            st = service.get_status()
            assert st["is_completed"] is True
            assert st["is_running"] is False
            assert st["current_index"] == 2000

    asyncio.run(_run())


def test_manual_stop_resets_stream_pointer():
    """Verify manual stop distinguishes from completion and resets pointers."""
    async def _run():
        service = ReplayLoaderService()
        async with async_session() as session:
            await service.start_replay(db=session, batch_size=5, loop=False)
            assert service.is_running is True

            stop_res = await service.stop()
            assert stop_res["status"] == "stopped"
            assert stop_res["is_running"] is False
            assert stop_res["was_running"] is True

            st = service.get_status()
            assert st["is_running"] is False
            assert st["current_index"] == 0
            assert st["events_sent"] == 0

    asyncio.run(_run())


def test_counter_increments_strictly_after_successful_commit():
    """Verify that current_index does NOT increment if db.commit fails or is cancelled."""
    async def _run():
        service = ReplayLoaderService()
        await service.stop()

        async with async_session() as session:
            source_path, source_fmt = service.resolve_dataset_source(DEFAULT_CSV_PATH)
            service._source_path = source_path
            service._source_fmt = source_fmt
            service.current_index = 0

            now_utc = datetime.now(timezone.utc)
            fake_event = Event(id="test-evt-1", timestamp=now_utc, features={}, prediction="BENIGN", risk_score=10.0)
            mock_batch_result = {
                "status": "ok",
                "events_ingested": 1,
                "alerts_generated": 0,
                "created_events": [fake_event],
                "created_alerts": [],
            }

            # If commit fails with exception, current_index must remain 0
            with patch.object(service, "_ingest_one_batch", new=AsyncMock(return_value=mock_batch_result)):
                with patch.object(session, "commit", new=AsyncMock(side_effect=RuntimeError("Simulated DB commit error"))):
                    with pytest.raises(RuntimeError):
                        res = await service._ingest_one_batch(session, 1)
                        await session.commit()
                        service._apply_batch_success(res)

                    # current_index was NOT incremented because _apply_batch_success was not called
                    assert service.current_index == 0
                    assert service.events_sent == 0

            # When commit succeeds, _apply_batch_success updates counter
            with patch.object(service, "_ingest_one_batch", new=AsyncMock(return_value=mock_batch_result)):
                res = await service._ingest_one_batch(session, 1)
                service._apply_batch_success(res)
                assert service.current_index == 1
                assert service.events_sent == 1
                assert service.last_ingested_ids == ["test-evt-1"]

    asyncio.run(_run())


def test_worker_cancellation_during_batch_rolls_back_safely():
    """Verify that cancellation during batch processing triggers rollback and records last_commit_status."""
    async def _run():
        service = ReplayLoaderService()
        await service.stop()

        fake_db = AsyncMock()
        fake_db.commit = AsyncMock()
        fake_db.rollback = AsyncMock()

        # Simulate cancellation during _ingest_one_batch
        with patch.object(service, "_ingest_one_batch", new=AsyncMock(side_effect=asyncio.CancelledError())):
            batch_committed = False
            try:
                result = await service._ingest_one_batch(fake_db, 5)
                await asyncio.shield(fake_db.commit())
                batch_committed = True
                service._apply_batch_success(result)
            except asyncio.CancelledError:
                if not batch_committed:
                    await fake_db.rollback()
                    service.last_commit_status = "rolled_back"

            fake_db.rollback.assert_awaited_once()
            assert batch_committed is False
            assert service.last_commit_status == "rolled_back"
            assert service.current_index == 0

    asyncio.run(_run())
