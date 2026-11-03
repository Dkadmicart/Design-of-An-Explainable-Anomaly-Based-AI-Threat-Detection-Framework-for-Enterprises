"""
SentinelAI - ML Service Interfaces
Abstract base class for detection models and risk scoring.
"""
from abc import ABC, abstractmethod
from typing import Dict, List, Optional, Any
from dataclasses import dataclass
import numpy as np


@dataclass
class PredictionResult:
    """Result from a model prediction."""
    prediction: str  # "BENIGN" or attack type
    confidence: float  # 0.0 - 1.0
    probabilities: Dict[str, float]  # class -> probability
    model_name: str
    model_version: str
    margin: Optional[float] = None  # Raw unconstrained decision margin (log-odds) from booster


@dataclass
class ExplanationResult:
    """Feature contribution explanation for a prediction."""
    feature_contributions: List[Dict[str, Any]]  # [{feature, value, display_name}]
    method: str  # "shap", "permutation", "demo"
    model_name: str


class DetectionModel(ABC):
    """Abstract base class for all detection models.
    
    All models must implement this interface so they can be
    swapped without rewriting the application.
    """

    @abstractmethod
    def predict(self, features: Dict[str, float]) -> PredictionResult:
        """Make a single prediction."""
        ...

    @abstractmethod
    def predict_batch(self, feature_batch: List[Dict[str, float]]) -> List[PredictionResult]:
        """Make predictions on a batch of features."""
        ...

    @abstractmethod
    def predict_proba(self, features: Dict[str, float]) -> Dict[str, float]:
        """Return class probabilities."""
        ...

    @abstractmethod
    def explain(self, features: Dict[str, float]) -> ExplanationResult:
        """Explain why a prediction was made."""
        ...

    @abstractmethod
    def get_info(self) -> Dict[str, Any]:
        """Return model metadata."""
        ...


class RiskScorer:
    """Transparent, deterministic continuous risk scoring service for cybersecurity threat evaluation.

    Combines model anomaly evidence, attack severity impact, and historical context
    into a continuous, deterministic 0–100 composite risk score.

    Severity Bands:
        0.0 - 24.9:  LOW      (Normal baseline activity with minimal or zero suspicion)
        25.0 - 49.9: MEDIUM   (Elevated anomaly or suspicious host context, under threshold)
        50.0 - 74.9: HIGH     (Flagged threat event meeting threshold, requires triage)
        75.0 - 100.0: CRITICAL (High-severity intrusion, flood, or exploit with strong evidence)

    Formula & Methodology:
    -----------------------
    The composite risk score integrates three authentic dimensions:
    Risk = 100 * (w_evidence * S_evidence + w_severity * S_severity + w_context * S_context)

    1. S_evidence in [0.0, 1.0] (Model Anomaly Evidence):
       - Primary: When decision margin m is available from the tree ensemble:
         S_evidence = 1.0 / (1.0 + exp(-m / T)) with calibration temperature T = 10.0.
         This provides a smooth, continuous, monotonic mapping from the raw tree log-odds
         (spanning approximately [-18.0, +15.0]) without premature sigmoid saturation.
       - Fallback: When margin is not available, uses anomaly_score (P(ATTACK)) or (1 - confidence),
         scaled to preserve continuous variation.

    2. S_severity in [0.0, 1.0] (Impact Assessment):
       - Looked up from ATTACK_SEVERITY by attack classification.
       - Documented neutral default of 0.70 for generic verified ATTACK, 0.60 for UNKNOWN.
       - Baseline 0.05 for BENIGN.

    3. S_context in [0.0, 1.0] (Host Historical Risk):
       - Normalized historical risk score of the source IP: min(1.0, max(0.0, historical_risk / 100.0)).
       - Neutral default is 0.0 when no historical records exist.

    Composite Normalization:
    - Weights: w_evidence = 0.50, w_severity = 0.35, w_context = 0.15 (sum to 1.0).
    - BENIGN predictions are scaled smoothly into the LOW/MEDIUM range ([0.5, 49.0])
      so that standard benign traffic remains comfortably < 25.0 (LOW), but can rise if
      borderline anomaly evidence or suspicious historical host context is present.
    - ATTACK predictions map into [50.0, 100.0] ([40.0 + raw * 60.0]), ensuring all
      verified attacks meet or exceed the ALERT_RISK_THRESHOLD (50.0) while distributing
      continuously across HIGH (50-74) and CRITICAL (75-100) based on actual evidence.
    """

    # Severity weights for different attack types
    ATTACK_SEVERITY: Dict[str, float] = {
        "BENIGN": 0.05,
        "PortScan": 0.50,
        "Brute Force": 0.65,
        "DoS": 0.75,
        "Web Attack": 0.80,
        "DDoS": 0.85,
        "Botnet": 0.90,
        "Infiltration": 0.95,
        "ATTACK": 0.70,
        "UNKNOWN": 0.60,
    }

    # Weight configuration (sums to 1.0)
    WEIGHT_EVIDENCE: float = 0.50
    WEIGHT_SEVERITY: float = 0.35
    WEIGHT_HISTORICAL: float = 0.15

    # Retained for backward compatibility
    WEIGHT_CONFIDENCE: float = 0.35
    WEIGHT_ANOMALY: float = 0.25

    @classmethod
    def calculate(
        cls,
        prediction: str,
        confidence: float,
        anomaly_score: Optional[float] = None,
        attack_type: Optional[str] = None,
        historical_risk: Optional[float] = None,
        margin: Optional[float] = None,
        flow_features: Optional[Dict[str, Any]] = None,
    ) -> float:
        """Calculate continuous, deterministic composite risk score in [0.0, 100.0].

        Args:
            prediction: Model prediction ("BENIGN" or "ATTACK")
            confidence: Model confidence (0.0 to 1.0)
            anomaly_score: Optional attack probability (0.0 to 1.0)
            attack_type: Attack classification or None
            historical_risk: Historical risk score for IP (0.0 to 100.0)
            margin: Optional raw decision margin (log-odds) from booster
            flow_features: Optional dictionary of raw flow features

        Returns:
            Continuous composite risk score rounded to 1 decimal place [0.0, 100.0]
        """
        pred_upper = (prediction or "BENIGN").strip().upper()
        conf = float(confidence or 0.0)
        ano = float(anomaly_score if anomaly_score is not None else (1.0 - conf if pred_upper == "BENIGN" else conf))
        hist = float(historical_risk or 0.0)

        # 1. Anomaly Evidence Score S_evidence in [0.0, 1.0]
        if margin is not None and not np.isnan(float(margin)):
            # Calibrated logistic over decision margin with temperature T=10.0
            # S_evidence is smooth, continuous, and strictly monotonic across [-18, +15]
            m_val = float(margin)
            s_evidence = float(1.0 / (1.0 + np.exp(-m_val / 10.0)))
        else:
            if pred_upper == "ATTACK":
                s_evidence = min(0.95, max(0.50, 0.50 + 0.45 * ano))
            else:
                s_evidence = min(0.48, max(0.05, 0.05 + 0.43 * ano))

        # 2. Severity Score S_severity in [0.0, 1.0]
        eff_type = attack_type or ("ATTACK" if pred_upper == "ATTACK" else "BENIGN")
        s_sev = cls.ATTACK_SEVERITY.get(eff_type, 0.60)

        # 3. Context Score S_context in [0.0, 1.0]
        s_ctx = min(1.0, max(0.0, hist / 100.0))

        # 4. Composite Combination
        raw = (
            cls.WEIGHT_EVIDENCE * s_evidence
            + cls.WEIGHT_SEVERITY * s_sev
            + cls.WEIGHT_HISTORICAL * s_ctx
        )

        if pred_upper == "BENIGN":
            score = min(49.0, max(0.5, raw * 50.0))
        else:
            score = min(100.0, max(50.0, 40.0 + raw * 60.0))

        return round(float(score), 1)

    @staticmethod
    def categorize(risk_score: float) -> str:
        """Categorize a risk score into standard cybersecurity severity bands."""
        if risk_score >= 75.0:
            return "CRITICAL"
        elif risk_score >= 50.0:
            return "HIGH"
        elif risk_score >= 25.0:
            return "MEDIUM"
        return "LOW"
