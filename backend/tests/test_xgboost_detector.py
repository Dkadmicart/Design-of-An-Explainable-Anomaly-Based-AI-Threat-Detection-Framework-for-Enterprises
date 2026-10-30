"""
Comprehensive test suite for SentinelAI XGBoost Threat Detector and Models API.
Tests artifact loading, validation, benign/attack prediction, TreeSHAP explainability, and HTTP API endpoints.
"""
import pytest
import numpy as np
from fastapi.testclient import TestClient

from app.main import app
from app.ml.xgboost_detector import XGBoostDetector, get_xgboost_detector
from app.ml.base import RiskScorer


@pytest.fixture(scope="module")
def detector():
    """Fixture providing initialized detector."""
    return get_xgboost_detector()


@pytest.fixture(scope="module")
def client():
    """FastAPI TestClient fixture."""
    return TestClient(app)


# ─── 1. Artifact Loading & Metadata Tests ───────────────────────────────────

def test_detector_initialization(detector: XGBoostDetector):
    """Confirm detector loads all artifacts, sets 69 features, and initializes booster."""
    assert detector is not None
    assert len(detector.feature_columns) == 69
    assert detector.imputer is not None
    assert hasattr(detector.imputer, "statistics_")
    assert len(detector.imputer.statistics_) == 69
    assert detector.model is not None
    assert detector.booster is not None

    info = detector.get_info()
    assert info["id"] == "xgboost-cicids2017-v1"
    assert info["n_features"] == 69
    assert info["status"] == "ACTIVE"
    assert info["model_type"] == "Gradient Boosted Trees"


def test_feature_columns_exact_order(detector: XGBoostDetector):
    """Verify first, middle, and last feature columns match the 69 CIC-IDS2017 specification."""
    cols = detector.feature_columns
    assert cols[0] == "Protocol"
    assert cols[1] == "Flow Duration"
    assert cols[2] == "Total Fwd Packets"
    assert cols[-1] == "Idle Min"
    assert cols[-2] == "Idle Max"
    assert "FIN Flag Count" in cols
    assert "SYN Flag Count" in cols
    assert "Avg Packet Size" in cols


# ─── 2. Input Validation Tests ──────────────────────────────────────────────

def test_validation_empty_dict(detector: XGBoostDetector):
    """Reject empty feature payloads with ValueError."""
    with pytest.raises(ValueError, match="must be a non-empty dictionary"):
        detector.validate_features({})


def test_validation_non_dict(detector: XGBoostDetector):
    """Reject non-dictionary inputs."""
    with pytest.raises(ValueError, match="must be a non-empty dictionary"):
        detector.validate_features("not a dict")  # type: ignore


def test_validation_no_recognized_features(detector: XGBoostDetector):
    """Reject payloads that contain none of the 69 CIC-IDS2017 features."""
    with pytest.raises(ValueError, match="No recognized CIC-IDS2017 features provided"):
        detector.validate_features({"unrelated_col_a": 123, "unrelated_col_b": 456})


def test_validation_invalid_non_numeric_type(detector: XGBoostDetector):
    """Reject non-numeric string values that cannot be parsed as floats."""
    with pytest.raises(ValueError, match="Invalid non-numeric value for feature 'Protocol'"):
        detector.validate_features({"Protocol": "tcp_packet", "Flow Duration": 100})


def test_validation_all_nulls(detector: XGBoostDetector):
    """Reject payloads where all provided recognized features are null."""
    with pytest.raises(ValueError, match="All provided feature values are null or NaN"):
        detector.validate_features({"Protocol": None, "Flow Duration": None})


def test_validation_partial_features_valid(detector: XGBoostDetector):
    """Accept valid subset of features and ignore extraneous unmapped metadata."""
    features = {
        "Protocol": 6,
        "Flow Duration": 120000.5,
        "source_ip": "192.168.1.100",  # extraneous metadata, should be ignored
        "destination_ip": "10.0.0.1",
    }
    cleaned = detector.validate_features(features)
    assert cleaned["Protocol"] == 6.0
    assert cleaned["Flow Duration"] == 120000.5
    assert "source_ip" not in cleaned


# ─── 3. Inference & Scoring Tests ───────────────────────────────────────────

def test_predict_benign_sample(detector: XGBoostDetector):
    """Test standard benign network flow inference."""
    features = {
        "Protocol": 6,
        "Flow Duration": 50000,
        "Total Fwd Packets": 2,
        "Total Backward Packets": 2,
        "Fwd Packets Length Total": 120.0,
        "Bwd Packets Length Total": 240.0,
        "Packet Length Mean": 90.0,
    }
    result = detector.predict(features)
    assert result.prediction == "BENIGN"
    assert result.confidence >= 0.90
    assert "BENIGN" in result.probabilities
    assert "ATTACK" in result.probabilities
    assert result.probabilities["BENIGN"] + result.probabilities["ATTACK"] == pytest.approx(1.0, abs=1e-4)


def test_score_service_and_risk_scorer_consistency(detector: XGBoostDetector):
    """Ensure RiskScorer calculation is consistent and separates probability, anomaly, and risk."""
    features = {
        "Protocol": 6,
        "Flow Duration": 100000,
        "Total Fwd Packets": 5,
        "Total Backward Packets": 4,
    }
    score_res = detector.score(features, historical_risk=10.0)

    assert score_res["prediction"] in ["BENIGN", "ATTACK"]
    assert 0.0 <= score_res["confidence"] <= 1.0
    assert 0.0 <= score_res["anomaly_score"] <= 1.0
    assert 0.0 <= score_res["risk_score"] <= 100.0
    assert score_res["severity"] in ["LOW", "MEDIUM", "HIGH", "CRITICAL"]

    # Verify anomaly score is P(ATTACK)
    assert score_res["anomaly_score"] == pytest.approx(score_res["probabilities"]["ATTACK"], abs=1e-4)

    # Verify risk_score matches direct RiskScorer calculation
    expected_risk = RiskScorer.calculate(
        prediction=score_res["prediction"],
        confidence=score_res["confidence"],
        anomaly_score=score_res["anomaly_score"],
        attack_type=score_res["attack_type"] or "BENIGN",
        historical_risk=10.0,
    )
    assert score_res["risk_score"] == pytest.approx(expected_risk, abs=0.1)


def test_predict_batch(detector: XGBoostDetector):
    """Verify batch prediction returns matching length list."""
    batch = [
        {"Protocol": 6, "Flow Duration": 1000},
        {"Protocol": 17, "Flow Duration": 2500},
    ]
    results = detector.predict_batch(batch)
    assert len(results) == 2
    assert results[0].prediction == "BENIGN"
    assert results[1].prediction == "BENIGN"


# ─── 4. TreeSHAP Explanation Tests ──────────────────────────────────────────

def test_explain_output(detector: XGBoostDetector):
    """Verify TreeSHAP generates top_k contributions and ranks them by absolute impact."""
    features = {
        "Protocol": 6,
        "Flow Duration": 300000,
        "Total Fwd Packets": 25,
        "Bwd Packet Length Mean": 500.0,
    }
    exp = detector.explain(features, top_k=5)
    assert exp.model_name == detector.model_name
    assert "TreeSHAP" in exp.method
    assert len(exp.feature_contributions) == 5

    # Check that contributions are sorted descending by absolute value
    abs_shaps = [abs(c["shap_value"]) for c in exp.feature_contributions]
    assert abs_shaps == sorted(abs_shaps, reverse=True)

    # Check item schema
    top_item = exp.feature_contributions[0]
    assert "feature" in top_item
    assert "display_name" in top_item
    assert "raw_value" in top_item
    assert "shap_value" in top_item
    assert top_item["impact"] in ["malicious", "benign"]
    assert 0.0 <= top_item["percentage"] <= 100.0


def test_treeshap_margin_exact_mathematics(detector: XGBoostDetector):
    """Verify exact TreeSHAP margin equality: sum(shap) + bias == log-odds margin."""
    features = {
        "Protocol": 6,
        "Flow Duration": 150000,
        "Total Fwd Packets": 10,
        "Total Backward Packets": 5,
    }
    _, imputed = detector.prepare_feature_array(features)
    import xgboost as xgb
    dmatrix = xgb.DMatrix(imputed)
    contribs = detector.booster.predict(dmatrix, pred_contribs=True)[0]

    feature_contribs = contribs[:-1]
    bias = contribs[-1]
    computed_margin = np.sum(feature_contribs) + bias

    prob_from_margin = 1.0 / (1.0 + np.exp(-computed_margin))
    actual_prob_attack = detector.model.predict_proba(imputed)[0, 1]

    # Must match to extreme precision
    assert prob_from_margin == pytest.approx(actual_prob_attack, rel=1e-5)


# ─── 5. FastAPI HTTP Endpoints Tests ────────────────────────────────────────

def test_api_list_models(client: TestClient):
    """GET /api/models returns registered XGBoost model."""
    res = client.get("/api/models")
    assert res.status_code == 200
    data = res.json()
    assert "models" in data
    assert len(data["models"]) >= 1
    assert data["models"][0]["id"] == "xgboost-cicids2017-v1"
    assert data["models"][0]["status"] == "ACTIVE"
    assert data["models"][0]["n_features"] == 69


def test_api_get_model_details(client: TestClient):
    """GET /api/models/{id} returns details for valid ID and 404 for invalid."""
    res_valid = client.get("/api/models/xgboost-cicids2017-v1")
    assert res_valid.status_code == 200
    assert res_valid.json()["model"]["name"] == "XGBoost Grouped Classifier"

    res_active = client.get("/api/models/active")
    assert res_active.status_code == 200
    assert res_active.json()["model"]["n_features"] == 69

    res_invalid = client.get("/api/models/nonexistent-model-id")
    assert res_invalid.status_code == 404


def test_api_get_model_features(client: TestClient):
    """GET /api/models/active/features returns 69 features."""
    res = client.get("/api/models/active/features")
    assert res.status_code == 200
    data = res.json()
    assert data["n_features"] == 69
    assert len(data["features"]) == 69
    assert data["features"][0] == "Protocol"


def test_api_predict_success(client: TestClient):
    """POST /api/models/predict produces valid inference and risk scores."""
    payload = {
        "features": {
            "Protocol": 6,
            "Flow Duration": 120000,
            "Total Fwd Packets": 4,
            "Total Backward Packets": 4,
        },
        "historical_risk": 5.0,
    }
    res = client.post("/api/models/predict", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["prediction"] in ["BENIGN", "ATTACK"]
    assert 0.0 <= data["confidence"] <= 1.0
    assert 0.0 <= data["anomaly_score"] <= 1.0
    assert 0.0 <= data["risk_score"] <= 100.0
    assert data["severity"] in ["LOW", "MEDIUM", "HIGH", "CRITICAL"]


def test_api_predict_validation_errors(client: TestClient):
    """POST /api/models/predict returns 422 for invalid payloads."""
    # 1. Empty features
    res1 = client.post("/api/models/predict", json={"features": {}})
    assert res1.status_code == 422

    # 2. Unrecognized features
    res2 = client.post("/api/models/predict", json={"features": {"bad_column": 123}})
    assert res2.status_code == 422
    assert "No recognized CIC-IDS2017 features" in res2.json()["detail"]

    # 3. Non-numeric value
    res3 = client.post("/api/models/predict", json={"features": {"Protocol": "not-a-number"}})
    assert res3.status_code == 422
    assert "Invalid non-numeric value" in res3.json()["detail"]


def test_api_explain_success(client: TestClient):
    """POST /api/models/explain returns TreeSHAP waterfall vector and disclaimer."""
    payload = {
        "features": {
            "Protocol": 6,
            "Flow Duration": 250000,
            "Total Fwd Packets": 12,
            "Total Backward Packets": 8,
        },
        "top_k": 7,
    }
    res = client.post("/api/models/explain", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["method"] == "TreeSHAP (additive log-odds margin attribution)"
    assert len(data["feature_contributions"]) == 7
    assert "explanation_notes" in data
    assert "log-odds" in data["explanation_notes"]
    assert "base_value" in data
    assert "margin" in data


def test_api_explain_validation_error(client: TestClient):
    """POST /api/models/explain returns 422 for invalid payload."""
    res = client.post("/api/models/explain", json={"features": {}})
    assert res.status_code == 422
