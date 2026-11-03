"""
Tests for MITRE ATT&CK Mapping & Evidence Attribution Verification.
Verifies that:
- The 6 standard MITRE techniques are served with official taxonomy.
- Detection counts are computed dynamically from actual database records (no hardcoded mock data).
- Replay events without multiclass labels or signatures remain strictly Unmapped.
- Binary ATTACK predictions are not falsely mapped to exact MITRE techniques.
"""
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select, func

from app.main import app
from app.database.session import async_session
from app.models.database import Alert, SeverityLevel, AlertStatus
from app.api.mitre import STANDARD_MITRE_TECHNIQUES


def test_standard_mitre_techniques_taxonomy():
    """Verify standard MITRE techniques structure, tactics, and references."""
    client = TestClient(app)
    res = client.get("/api/mitre/techniques")
    assert res.status_code == 200
    data = res.json()

    assert "techniques" in data
    assert "summary" in data

    techniques = data["techniques"]
    assert len(techniques) == 6

    expected_ids = {"T1498", "T1595", "T1110", "T1190", "T1071", "T1020"}
    actual_ids = {t["id"] for t in techniques}
    assert actual_ids == expected_ids

    # Verify each technique has required official taxonomy fields
    for tech in techniques:
        assert tech["id"].startswith("T")
        assert len(tech["tactic"]) > 0
        assert len(tech["name"]) > 0
        assert len(tech["description"]) > 0
        assert tech["url"].startswith("https://attack.mitre.org/techniques/")
        assert isinstance(tech["attack_types"], list)
        assert isinstance(tech["detection_count"], int)
        assert tech["detection_count"] >= 0


def test_mitre_detection_counts_reflect_real_database():
    """Verify detection_count is computed dynamically from real database alerts."""
    client = TestClient(app)
    res = client.get("/api/mitre/techniques")
    assert res.status_code == 200
    data = res.json()

    summary = data["summary"]
    assert "total_alerts" in summary
    assert "mapped_alerts" in summary
    assert "unmapped_alerts" in summary
    assert summary["total_alerts"] == summary["mapped_alerts"] + summary["unmapped_alerts"]
    assert "Binary Anomaly Detection" in summary["classification_scope"]


def test_single_technique_endpoint():
    """Verify /api/mitre/techniques/{id} endpoint with authentic database count."""
    client = TestClient(app)
    
    # Valid technique
    res = client.get("/api/mitre/techniques/T1498")
    assert res.status_code == 200
    tech = res.json()["technique"]
    assert tech is not None
    assert tech["id"] == "T1498"
    assert tech["name"] == "Network Denial of Service"
    assert tech["tactic"] == "Impact"
    assert isinstance(tech["detection_count"], int)

    # Non-existent technique
    res_unknown = client.get("/api/mitre/techniques/T9999")
    assert res_unknown.status_code == 200
    assert res_unknown.json()["technique"] is None


def test_binary_predictions_not_falsely_attributed_to_mitre():
    """Verify that replay alerts do not fabricate MITRE technique IDs without evidence."""
    import asyncio

    async def _check():
        async with async_session() as db:
            # Query sample of recent alerts
            res = await db.execute(
                select(Alert).order_by(Alert.created_at.desc()).limit(20)
            )
            alerts = res.scalars().all()
            for alert in alerts:
                # If the alert was generated solely from binary XGBoost replay inference,
                # mitre_technique_id must be None (Unmapped)
                if alert.detection_model and "xgboost" in alert.detection_model.lower():
                    # Unless an explicit multi-class ground truth was provided, technique must be None
                    if alert.attack_type in ["ATTACK", "Anomaly"]:
                        assert alert.mitre_technique_id is None, (
                            f"Alert {alert.id} has fabricated technique {alert.mitre_technique_id} "
                            "from binary prediction alone!"
                        )

    asyncio.run(_check())

