"""
SentinelAI - SQLAlchemy ORM Models
Database schema for the threat detection platform.
"""
from sqlalchemy import (
    Column, String, Integer, Float, Boolean, DateTime, Text, JSON,
    ForeignKey, Index, Enum as SAEnum
)
from sqlalchemy.orm import DeclarativeBase, relationship
from datetime import datetime
import enum
import uuid


class Base(DeclarativeBase):
    """SQLAlchemy declarative base."""
    pass


# ─── Enums ───────────────────────────────────────────────────────────────────

class SeverityLevel(str, enum.Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


class AlertStatus(str, enum.Enum):
    NEW = "NEW"
    INVESTIGATING = "INVESTIGATING"
    CONFIRMED = "CONFIRMED"
    BENIGN = "BENIGN"
    ESCALATED = "ESCALATED"
    RESOLVED = "RESOLVED"


class ModelStatus(str, enum.Enum):
    ACTIVE = "ACTIVE"
    INACTIVE = "INACTIVE"
    TRAINING = "TRAINING"
    EVALUATING = "EVALUATING"
    FAILED = "FAILED"


class DatasetRunStatus(str, enum.Enum):
    PENDING = "PENDING"
    PROCESSING = "PROCESSING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"


class AttackType(str, enum.Enum):
    BENIGN = "BENIGN"
    DDOS = "DDoS"
    DOS = "DoS"
    PORTSCAN = "PortScan"
    BOTNET = "Botnet"
    BRUTE_FORCE = "Brute Force"
    WEB_ATTACK = "Web Attack"
    INFILTRATION = "Infiltration"
    UNKNOWN = "UNKNOWN"


# ─── Models ──────────────────────────────────────────────────────────────────

class Event(Base):
    """Network security event record."""
    __tablename__ = "events"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    timestamp = Column(DateTime, nullable=False, index=True, default=datetime.utcnow)
    
    # Network fields
    source_ip = Column(String(45), nullable=False, index=True)
    destination_ip = Column(String(45), nullable=False, index=True)
    source_port = Column(Integer, nullable=True)
    destination_port = Column(Integer, nullable=True)
    protocol = Column(String(20), nullable=True)
    
    # Flow features
    flow_duration = Column(Float, nullable=True)
    total_fwd_packets = Column(Integer, nullable=True)
    total_bwd_packets = Column(Integer, nullable=True)
    total_length_fwd_packets = Column(Float, nullable=True)
    total_length_bwd_packets = Column(Float, nullable=True)
    flow_bytes_per_sec = Column(Float, nullable=True)
    flow_packets_per_sec = Column(Float, nullable=True)
    
    # Extended features stored as JSON
    features = Column(JSON, nullable=True)
    
    # ML predictions
    prediction = Column(String(50), nullable=True)
    confidence = Column(Float, nullable=True)
    anomaly_score = Column(Float, nullable=True)
    risk_score = Column(Float, nullable=True)
    attack_type = Column(String(50), nullable=True, index=True)
    
    # Model info
    model_version = Column(String(50), nullable=True)
    model_name = Column(String(100), nullable=True)
    
    # Metadata
    dataset_source = Column(String(100), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    alerts = relationship("Alert", back_populates="event", cascade="all, delete-orphan")

    __table_args__ = (
        Index("idx_events_timestamp_attack", "timestamp", "attack_type"),
        Index("idx_events_risk", "risk_score"),
    )


class Alert(Base):
    """Security alert generated from event detections."""
    __tablename__ = "alerts"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    event_id = Column(String(36), ForeignKey("events.id"), nullable=False, index=True)
    
    # Alert details
    severity = Column(SAEnum(SeverityLevel), nullable=False, index=True)
    attack_type = Column(String(50), nullable=False)
    status = Column(SAEnum(AlertStatus), default=AlertStatus.NEW, index=True)
    
    # Scores
    risk_score = Column(Float, nullable=False)
    confidence = Column(Float, nullable=True)
    
    # Detection info
    detection_model = Column(String(100), nullable=True)
    detection_reason = Column(Text, nullable=True)
    
    # MITRE ATT&CK
    mitre_tactic = Column(String(100), nullable=True)
    mitre_technique_id = Column(String(20), nullable=True)
    mitre_technique_name = Column(String(200), nullable=True)
    
    # Network context
    source_ip = Column(String(45), nullable=False)
    destination_ip = Column(String(45), nullable=False)
    source_port = Column(Integer, nullable=True)
    destination_port = Column(Integer, nullable=True)
    protocol = Column(String(20), nullable=True)
    
    # Timestamps
    first_seen = Column(DateTime, nullable=False, default=datetime.utcnow)
    last_seen = Column(DateTime, nullable=False, default=datetime.utcnow)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    resolved_at = Column(DateTime, nullable=True)
    
    # Relationships
    event = relationship("Event", back_populates="alerts")
    investigation = relationship("Investigation", back_populates="alert", uselist=False)
    notes = relationship("AnalystNote", back_populates="alert", cascade="all, delete-orphan")

    __table_args__ = (
        Index("idx_alerts_severity_status", "severity", "status"),
    )


class Investigation(Base):
    """Investigation record for an alert."""
    __tablename__ = "investigations"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    alert_id = Column(String(36), ForeignKey("alerts.id"), nullable=False, unique=True)
    
    analyst_id = Column(String(100), nullable=True)
    status = Column(String(50), default="OPEN")
    summary = Column(Text, nullable=True)
    findings = Column(JSON, nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    closed_at = Column(DateTime, nullable=True)
    
    # Relationships
    alert = relationship("Alert", back_populates="investigation")


class AnalystNote(Base):
    """Notes written by analysts during investigation."""
    __tablename__ = "analyst_notes"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    alert_id = Column(String(36), ForeignKey("alerts.id"), nullable=False, index=True)
    
    content = Column(Text, nullable=False)
    author = Column(String(100), nullable=True, default="analyst")
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    alert = relationship("Alert", back_populates="notes")


class MLModel(Base):
    """Registered ML model metadata."""
    __tablename__ = "models"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String(100), nullable=False, unique=True)
    version = Column(String(50), nullable=False)
    model_type = Column(String(50), nullable=False)  # RandomForest, XGBoost, etc.
    
    status = Column(SAEnum(ModelStatus), default=ModelStatus.INACTIVE)
    description = Column(Text, nullable=True)
    
    # Training info
    trained_at = Column(DateTime, nullable=True)
    training_dataset = Column(String(200), nullable=True)
    training_duration_sec = Column(Float, nullable=True)
    
    # Model file
    artifact_path = Column(String(500), nullable=True)
    
    # Configuration
    hyperparameters = Column(JSON, nullable=True)
    feature_names = Column(JSON, nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    metrics = relationship("ModelMetric", back_populates="model", cascade="all, delete-orphan")


class ModelMetric(Base):
    """Model evaluation metrics with proper dataset/split tracking."""
    __tablename__ = "model_metrics"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    model_id = Column(String(36), ForeignKey("models.id"), nullable=False, index=True)
    
    # What was evaluated
    dataset = Column(String(200), nullable=False)
    split = Column(String(20), nullable=False)  # train, validation, test
    
    # Metric
    metric_name = Column(String(50), nullable=False)  # precision, recall, f1, etc.
    metric_value = Column(Float, nullable=False)
    
    # Per-class metrics
    class_name = Column(String(50), nullable=True)  # e.g., "DDoS", "Benign"
    
    # Metadata
    timestamp = Column(DateTime, default=datetime.utcnow)
    model_version = Column(String(50), nullable=True)
    
    # Relationships
    model = relationship("MLModel", back_populates="metrics")

    __table_args__ = (
        Index("idx_metrics_model_dataset", "model_id", "dataset", "split"),
    )


class MitreTechnique(Base):
    """MITRE ATT&CK technique mapping."""
    __tablename__ = "mitre_techniques"

    id = Column(String(20), primary_key=True)  # e.g., T1046
    tactic = Column(String(100), nullable=False, index=True)
    name = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    url = Column(String(500), nullable=True)
    
    # Detection mapping
    attack_types = Column(JSON, nullable=True)  # Which attack types map to this technique
    detection_count = Column(Integer, default=0)
    
    created_at = Column(DateTime, default=datetime.utcnow)


class DatasetRun(Base):
    """Dataset import/processing run tracking."""
    __tablename__ = "dataset_runs"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    dataset_name = Column(String(200), nullable=False)
    file_name = Column(String(200), nullable=True)
    
    status = Column(SAEnum(DatasetRunStatus), default=DatasetRunStatus.PENDING)
    
    # Processing stats
    total_rows = Column(Integer, nullable=True)
    rows_processed = Column(Integer, default=0)
    rows_failed = Column(Integer, default=0)
    
    # Timing
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    
    # Results
    error_message = Column(Text, nullable=True)
    processing_notes = Column(JSON, nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
