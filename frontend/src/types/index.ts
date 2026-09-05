// ─── Enums ──────────────────────────────────────────────────────────────────

export type SeverityLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type AlertStatus = 'NEW' | 'INVESTIGATING' | 'CONFIRMED' | 'BENIGN' | 'ESCALATED' | 'RESOLVED';
export type ModelStatus = 'ACTIVE' | 'INACTIVE' | 'TRAINING' | 'EVALUATING' | 'FAILED';
export type AttackType = 'BENIGN' | 'DDoS' | 'DoS' | 'PortScan' | 'Botnet' | 'Brute Force' | 'Web Attack' | 'Infiltration' | 'UNKNOWN';
export type EnvironmentMode = 'replay' | 'live';
export type RiskCategory = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

// ─── Event ──────────────────────────────────────────────────────────────────

export interface NetworkEvent {
  id: string;
  timestamp: string;
  source_ip: string;
  destination_ip: string;
  source_port: number;
  destination_port: number;
  protocol: string;
  flow_duration: number;
  total_fwd_packets: number;
  total_bwd_packets: number;
  total_length_fwd_packets: number;
  total_length_bwd_packets: number;
  flow_bytes_per_sec: number;
  flow_packets_per_sec: number;
  features: Record<string, number>;
  prediction: string;
  confidence: number;
  anomaly_score: number | null;
  risk_score: number;
  attack_type: AttackType;
  model_version: string;
  model_name: string;
  dataset_source: string | null;
}

// ─── Alert ──────────────────────────────────────────────────────────────────

export interface Alert {
  id: string;
  event_id: string;
  severity: SeverityLevel;
  attack_type: string;
  status: AlertStatus;
  risk_score: number;
  confidence: number;
  detection_model: string;
  detection_reason: string;
  mitre_tactic: string | null;
  mitre_technique_id: string | null;
  mitre_technique_name: string | null;
  source_ip: string;
  destination_ip: string;
  source_port: number;
  destination_port: number;
  protocol: string;
  first_seen: string;
  last_seen: string;
  created_at: string;
}

// ─── Investigation ──────────────────────────────────────────────────────────

export interface Investigation {
  id: string;
  alert_id: string;
  analyst_id: string | null;
  status: string;
  summary: string | null;
  findings: Record<string, unknown> | null;
  created_at: string;
}

export interface AnalystNote {
  id: string;
  alert_id: string;
  content: string;
  author: string;
  created_at: string;
}

// ─── ML Model ───────────────────────────────────────────────────────────────

export interface MLModel {
  id: string;
  name: string;
  version: string;
  model_type: string;
  status: ModelStatus;
  description: string | null;
  trained_at: string | null;
  training_dataset: string | null;
  hyperparameters: Record<string, unknown> | null;
}

export interface ModelMetric {
  id: string;
  model_id: string;
  dataset: string;
  split: string;
  metric_name: string;
  metric_value: number;
  class_name: string | null;
  timestamp: string;
  model_version: string;
}

// ─── MITRE ATT&CK ──────────────────────────────────────────────────────────

export interface MitreTechnique {
  id: string;
  tactic: string;
  name: string;
  description: string;
  url: string | null;
  attack_types: string[];
  detection_count: number;
}

// ─── Dashboard ──────────────────────────────────────────────────────────────

export interface DashboardSummary {
  total_events: number;
  normal_events: number;
  suspicious_events: number;
  critical_alerts: number;
  detection_rate: number;
  false_positive_rate: number;
  total_events_trend: number;
  normal_events_trend: number;
  suspicious_events_trend: number;
  critical_alerts_trend: number;
  detection_rate_trend: number;
  false_positive_rate_trend: number;
}

export interface TimelinePoint {
  time: string;
  normal: number;
  suspicious: number;
  critical: number;
}

export interface AttackDistribution {
  type: AttackType;
  count: number;
  percentage: number;
}

export interface RiskDistribution {
  category: RiskCategory;
  count: number;
}

export interface TopSource {
  ip: string;
  events: number;
  risk_score: number;
  last_seen: string;
}

export interface ModelStatusInfo {
  current_model: string;
  version: string;
  last_trained: string;
  detection_mode: string;
  health: 'healthy' | 'degraded' | 'unhealthy';
}

// ─── System Health ──────────────────────────────────────────────────────────

export interface ServiceStatus {
  name: string;
  status: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
  latency_ms: number | null;
  message: string;
}

export interface SystemMetrics {
  cpu_percent: number;
  memory_percent: number;
  events_per_sec: number;
  avg_inference_ms: number;
  queue_size: number;
}

// ─── Dataset ────────────────────────────────────────────────────────────────

export interface DatasetFile {
  name: string;
  display_name: string;
  rows: number | null;
  columns: number | null;
  attack_types: string[];
  status: 'available' | 'imported' | 'processing' | 'not_found';
  size_mb: number | null;
}

export interface Dataset {
  name: string;
  description: string;
  source: string;
  files: DatasetFile[];
  last_imported: string | null;
  preprocessing_status: string;
}

// ─── Replay ─────────────────────────────────────────────────────────────────

export interface ReplayStatus {
  is_running: boolean;
  is_paused: boolean;
  speed: number;
  events_sent: number;
  total_events: number;
  current_file: string | null;
  elapsed_seconds: number;
}

// ─── Feature Contribution (Explainability) ──────────────────────────────────

export interface FeatureContribution {
  feature: string;
  value: number;
  display_name: string;
}

// ─── Investigation Search ───────────────────────────────────────────────────

export interface InvestigationResult {
  ip: string;
  first_seen: string;
  last_seen: string;
  total_events: number;
  attack_types: string[];
  risk_history: { time: string; risk: number }[];
  events: NetworkEvent[];
}

// ─── Settings ───────────────────────────────────────────────────────────────

export interface AppSettings {
  detection_mode: 'binary' | 'multiclass';
  alert_threshold: number;
  replay_speed: number;
  notifications_enabled: boolean;
  selected_model: string;
  selected_dataset: string;
}
