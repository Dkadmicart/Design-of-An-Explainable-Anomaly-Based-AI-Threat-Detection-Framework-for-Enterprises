"""
Pydantic schemas for Model Inference & TreeSHAP Explainability.
"""
from typing import Dict, List, Optional, Any
from pydantic import BaseModel, Field


class ModelPredictRequest(BaseModel):
    """Payload for triggering model prediction."""
    features: Dict[str, Any] = Field(
        ...,
        description="Dictionary of network flow features (subset or complete 69 CIC-IDS2017 features).",
    )
    attack_type: Optional[str] = Field(
        None,
        description="Optional known attack context (e.g., from network heuristics or telemetry).",
    )
    historical_risk: Optional[float] = Field(
        0.0,
        ge=0.0,
        le=100.0,
        description="Historical risk score (0-100) for the IP source if previously observed.",
    )


class ModelPredictResponse(BaseModel):
    """Response payload for model prediction and risk score calculation."""
    prediction: str = Field(..., description="Binary classification outcome: 'BENIGN' or 'ATTACK'.")
    confidence: float = Field(..., description="Probability associated with the predicted class (0.0 to 1.0).")
    probabilities: Dict[str, float] = Field(..., description="Calibrated class probabilities for BENIGN and ATTACK.")
    anomaly_score: float = Field(..., description="Probability of anomaly/threat (P(ATTACK), 0.0 to 1.0).")
    risk_score: float = Field(..., description="Transparent composite risk score (0.0 to 100.0) via RiskScorer.")
    severity: str = Field(..., description="Risk category: LOW (0-24), MEDIUM (25-49), HIGH (50-74), CRITICAL (75-100).")
    attack_type: Optional[str] = Field(None, description="Attack classification or None if benign.")
    model_name: str = Field(..., description="Name of the model that produced this prediction.")
    model_version: str = Field(..., description="Version of the active model.")


class ModelFeatureContribution(BaseModel):
    """Individual feature contribution to the log-odds margin."""
    feature: str
    display_name: str
    raw_value: str
    imputed_value: float
    shap_value: float
    impact: str = Field(..., description="'malicious' if pushes toward ATTACK (shap >= 0), 'benign' otherwise.")
    percentage: float = Field(..., description="Relative magnitude percentage among top features.")


class ModelExplainRequest(BaseModel):
    """Payload for requesting TreeSHAP attribution vector."""
    features: Dict[str, Any] = Field(..., description="Dictionary of input network flow features.")
    top_k: Optional[int] = Field(10, ge=1, le=69, description="Number of top influential features to return.")


class ModelExplainResponse(BaseModel):
    """Response payload containing TreeSHAP margin attributions and baseline."""
    prediction: str
    confidence: float
    anomaly_score: float
    base_value: float = Field(..., description="Expected value / bias term of the model in log-odds space.")
    margin: float = Field(..., description="Total log-odds score (sum of all feature contributions + base_value).")
    method: str = Field(..., description="Attribution method used (TreeSHAP).")
    feature_contributions: List[ModelFeatureContribution]
    explanation_notes: str = Field(
        ...,
        description="Scientific interpretation disclaimer on TreeSHAP log-odds vs probabilities.",
    )
