"""
SentinelAI - Tests for Alerts Workflow & Investigation Endpoints
Validates alert retrieval, status lifecycle transitions (NEW -> INVESTIGATING -> CONFIRMED -> RESOLVED / BENIGN),
and event-alert foreign key linkage.
"""
import uuid
from datetime import datetime, timezone
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select

from app.main import app
from app.database.session import async_session
from app.models.database import Event, Alert, AlertStatus, SeverityLevel


@pytest.fixture(scope="module")
def client():
    return TestClient(app)


@pytest.mark.anyio
async def test_alert_lifecycle_and_investigation_workflow(client):
    """Verify end-to-end alert status updates: NEW -> INVESTIGATING -> CONFIRMED -> RESOLVED."""
    test_id = str(uuid.uuid4())
    event_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).replace(tzinfo=None)

    # 1. Create a test event and linked alert in DB
    async with async_session() as db:
        event = Event(
            id=event_id,
            source_ip="172.16.0.1",
            destination_ip="192.168.10.50",
            source_port=52341,
            destination_port=80,
            protocol="TCP",
            flow_duration=120000.0,
            total_fwd_packets=10,
            total_bwd_packets=5,
            total_length_fwd_packets=1460.0,
            total_length_bwd_packets=200.0,
            flow_bytes_per_sec=12000.0,
            flow_packets_per_sec=125.0,
            features={"Protocol": 6, "Flow Duration": 120000.0, "Total Fwd Packets": 10},
            prediction="ATTACK",
            confidence=0.95,
            anomaly_score=0.95,
            risk_score=78.5,
            attack_type="ATTACK",
            model_name="XGBoost Grouped Classifier",
            model_version="v1.0.0",
            timestamp=now,
            created_at=now,
        )
        alert = Alert(
            id=test_id,
            event_id=event_id,
            severity=SeverityLevel.HIGH,
            attack_type="ATTACK",
            status=AlertStatus.NEW,
            risk_score=78.5,
            confidence=0.95,
            detection_model="XGBoost Grouped Classifier",
            detection_reason="XGBoost flagged flow anomaly",
            source_ip="172.16.0.1",
            destination_ip="192.168.10.50",
            source_port=52341,
            destination_port=80,
            protocol="TCP",
            first_seen=now,
            last_seen=now,
            created_at=now,
        )
        db.add(event)
        db.add(alert)
        await db.commit()

    try:
        # 2. GET /api/alerts/{id} returns the alert
        res = client.get(f"/api/alerts/{test_id}")
        assert res.status_code == 200
        data = res.json()["alert"]
        assert data["id"] == test_id
        assert data["event_id"] == event_id
        assert data["status"] == "NEW"
        assert data["risk_score"] == 78.5

        # 3. GET /api/events/{event_id} verifies linkage
        res_ev = client.get(f"/api/events/{event_id}")
        assert res_ev.status_code == 200
        ev_data = res_ev.json()["event"]
        assert ev_data["id"] == event_id
        assert ev_data["prediction"] == "ATTACK"

        # 4. POST /api/alerts/{id}/investigate marks as INVESTIGATING
        res_inv = client.post(f"/api/alerts/{test_id}/investigate", json={"notes": "Analyst began triage"})
        assert res_inv.status_code == 200
        assert res_inv.json()["status"] == "investigating"

        # Verify persisted state
        res_check1 = client.get(f"/api/alerts/{test_id}")
        assert res_check1.json()["alert"]["status"] == "INVESTIGATING"

        # 5. POST /api/alerts/{id}/confirm marks as CONFIRMED
        res_conf = client.post(f"/api/alerts/{test_id}/confirm", json={"notes": "Confirmed malicious SYN flood"})
        assert res_conf.status_code == 200
        res_check2 = client.get(f"/api/alerts/{test_id}")
        assert res_check2.json()["alert"]["status"] == "CONFIRMED"

        # 6. POST /api/alerts/{id}/resolve marks as RESOLVED
        res_res = client.post(f"/api/alerts/{test_id}/resolve", json={"notes": "Host isolated and block applied"})
        assert res_res.status_code == 200
        res_check3 = client.get(f"/api/alerts/{test_id}")
        assert res_check3.json()["alert"]["status"] == "RESOLVED"

        # 7. POST /api/alerts/{id}/benign marks as BENIGN (False Positive)
        res_ben = client.post(f"/api/alerts/{test_id}/benign", json={"notes": "Authorized pentest activity"})
        assert res_ben.status_code == 200
        res_check4 = client.get(f"/api/alerts/{test_id}")
        assert res_check4.json()["alert"]["status"] == "BENIGN"

    finally:
        # Cleanup test records
        async with async_session() as db:
            al_res = await db.execute(select(Alert).where(Alert.id == test_id))
            al_obj = al_res.scalar_one_or_none()
            if al_obj:
                await db.delete(al_obj)

            ev_res = await db.execute(select(Event).where(Event.id == event_id))
            ev_obj = ev_res.scalar_one_or_none()
            if ev_obj:
                await db.delete(ev_obj)

            await db.commit()
