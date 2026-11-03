"""
SentinelAI - Tests for Dashboard Summary & Attack Event Share Reconciliation
Validates exact formulas, reconciliation of counts, and prevention of ground-truth overclaiming.
"""
import pytest
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture(scope="module")
def client():
    return TestClient(app)


def test_dashboard_summary_kpi_and_reconciliation(client):
    """Verify /api/dashboard/summary calculates authentic attack event share and reconciles totals."""
    res = client.get("/api/dashboard/summary")
    assert res.status_code == 200
    data = res.json()

    assert "total_events" in data
    assert "normal_events" in data
    assert "suspicious_events" in data
    assert "critical_alerts" in data
    assert "detection_rate" in data
    assert "attack_event_share" in data

    total = data["total_events"]
    normal = data["normal_events"]
    suspicious = data["suspicious_events"]
    share = data["attack_event_share"]

    # 1. Total events reconciles with normal + suspicious events
    assert normal + suspicious == total

    # 2. Attack event share exact formula: round((suspicious / total) * 100, 2)
    if total > 0:
        expected_share = round((suspicious / total) * 100, 2)
        assert share == pytest.approx(expected_share, rel=1e-4)
        assert data["detection_rate"] == pytest.approx(expected_share, rel=1e-4)
    else:
        assert share == 0.0


def test_analytics_attack_distribution_reconciliation(client):
    """Verify /api/analytics/attack-distribution reconciles with /api/dashboard/summary counts."""
    res_summary = client.get("/api/dashboard/summary")
    res_dist = client.get("/api/analytics/attack-distribution")

    assert res_summary.status_code == 200
    assert res_dist.status_code == 200

    summary_data = res_summary.json()
    dist_data = res_dist.json()

    assert "distribution" in dist_data
    distribution = dist_data["distribution"]

    total_dist_count = sum(item["count"] for item in distribution)

    # 1. Distribution totals reconcile with summary total_events
    assert total_dist_count == summary_data["total_events"]

    # 2. Check categories reconcile with summary normal vs suspicious counts
    benign_dist_count = sum(item["count"] for item in distribution if (item.get("type") or "").upper() == "BENIGN")
    attack_dist_count = sum(item["count"] for item in distribution if (item.get("type") or "").upper() != "BENIGN")
    assert benign_dist_count == summary_data["normal_events"]
    assert attack_dist_count == summary_data["suspicious_events"]

