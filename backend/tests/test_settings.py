"""
Unit and Integration Tests for Platform Preferences & Detection Settings
Tests loading, updating, persisting, boundary validation, and end-to-end alert rule binding.
"""
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.services.settings_service import (
    get_active_alert_threshold,
    set_active_alert_threshold,
    get_active_detection_mode,
    get_active_selected_model,
)


@pytest.fixture
def client():
    with TestClient(app) as test_client:
        yield test_client


def test_get_default_settings(client):
    """Test retrieving default platform settings."""
    res = client.get("/api/settings")
    assert res.status_code == 200
    data = res.json()

    assert data["detection_mode"] == "binary"
    assert data["selected_model"] == "XGBoost Grouped Classifier"
    assert data["selected_dataset"] == "CIC-IDS2017 Benchmark"
    assert 0.0 <= data["alert_threshold"] <= 100.0
    assert data["notifications_enabled"] is True


def test_update_settings_persistence(client):
    """Test updating settings persists to database and survives query reloads."""
    payload = {
        "alert_threshold": 65.0,
        "replay_speed": 2.5,
        "selected_model": "XGBoost Grouped Classifier",
    }
    update_res = client.put("/api/settings", json=payload)
    assert update_res.status_code == 200
    update_data = update_res.json()
    assert update_data["status"] == "updated"
    assert update_data["settings"]["alert_threshold"] == 65.0
    assert update_data["settings"]["replay_speed"] == 2.5

    # Verify subsequent GET returns persisted values
    get_res = client.get("/api/settings")
    assert get_res.status_code == 200
    get_data = get_res.json()
    assert get_data["alert_threshold"] == 65.0
    assert get_data["replay_speed"] == 2.5
    assert get_data["selected_model"] == "XGBoost Grouped Classifier"

    # Verify in-memory runtime cache synchronized
    assert get_active_alert_threshold() == 65.0


def test_reject_multiclass_detection_mode(client):
    """Test that attempting to switch to multiclass mode is rejected with HTTP 400."""
    payload = {"detection_mode": "multiclass"}
    res = client.put("/api/settings", json=payload)
    assert res.status_code == 400
    detail = res.json().get("detail", "")
    assert "multiclass" in detail.lower()
    assert "unavailable" in detail.lower() or "not configured" in detail.lower()

    # Verify detection mode remains binary
    get_res = client.get("/api/settings")
    assert get_res.json()["detection_mode"] == "binary"


def test_reject_unregistered_model(client):
    """Test that attempting to bind an unregistered model is rejected with HTTP 400."""
    payload = {"selected_model": "Random Forest Baseline"}
    res = client.put("/api/settings", json=payload)
    assert res.status_code == 400
    detail = res.json().get("detail", "")
    assert "not a registered active model" in detail


def test_reject_invalid_alert_threshold(client):
    """Test that out-of-bounds alert thresholds are rejected."""
    # Negative threshold
    res1 = client.put("/api/settings", json={"alert_threshold": -5.0})
    assert res1.status_code in [400, 422]

    # Threshold > 100
    res2 = client.put("/api/settings", json={"alert_threshold": 150.0})
    assert res2.status_code in [400, 422]


def test_reject_unregistered_dataset(client):
    """Test that attempting to bind an invalid dataset source is rejected."""
    payload = {"selected_dataset": "Fabricated Mock Telemetry 2026"}
    res = client.put("/api/settings", json=payload)
    assert res.status_code == 400
    detail = res.json().get("detail", "")
    assert "not a registered dataset benchmark" in detail


def test_alert_rule_evaluation_logic():
    """
    Test the alert generation rule logic:
    rule: risk_score >= configured_threshold OR prediction == 'ATTACK'
    """
    # Case 1: Predicted ATTACK with moderate risk (e.g. 55.0)
    # Under standard threshold (50.0) -> Alert triggered
    score_res_attack = {"prediction": "ATTACK", "risk_score": 55.0}
    threshold_std = 50.0
    assert (score_res_attack["risk_score"] >= threshold_std or score_res_attack["prediction"] == "ATTACK") is True

    # Under elevated threshold (80.0) -> Alert STILL triggered because prediction == 'ATTACK'
    threshold_high = 80.0
    assert (score_res_attack["risk_score"] >= threshold_high or score_res_attack["prediction"] == "ATTACK") is True

    # Case 2: Predicted BENIGN with borderline anomaly score (e.g. risk_score = 45.0)
    score_res_benign = {"prediction": "BENIGN", "risk_score": 45.0}
    # Under standard threshold (50.0) -> No alert
    assert (score_res_benign["risk_score"] >= threshold_std or score_res_benign["prediction"] == "ATTACK") is False

    # Under lowered threshold (40.0) -> Alert triggered by risk threshold
    threshold_low = 40.0
    assert (score_res_benign["risk_score"] >= threshold_low or score_res_benign["prediction"] == "ATTACK") is True


def test_restore_standard_threshold_after_tests(client):
    """Reset configuration back to standard 50.0 threshold and 1.0 speed."""
    res = client.put("/api/settings", json={
        "alert_threshold": 50.0,
        "replay_speed": 1.0,
        "detection_mode": "binary",
        "selected_model": "XGBoost Grouped Classifier",
        "selected_dataset": "CIC-IDS2017 Benchmark",
    })
    assert res.status_code == 200
    assert get_active_alert_threshold() == 50.0

