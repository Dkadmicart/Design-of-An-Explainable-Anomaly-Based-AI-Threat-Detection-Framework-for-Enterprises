/**
 * MITRE ATT&CK Attribution & Evidence Integrity Helpers
 *
 * Enforces enterprise attribution rules:
 * - Binary XGBoost anomaly detections (BENIGN vs ATTACK) do not imply specific MITRE techniques.
 * - Technique attribution requires verified multi-class labels, signatures, or threat intel.
 * - Alerts lacking specific evidence are transparently designated Unmapped.
 */
import type { Alert, MitreTelemetrySummary } from '../types';

export interface FormattedMitreTelemetry {
  totalAlerts: string;
  mappedAlerts: string;
  unmappedAlerts: string;
  mappedPercent: string;
  unmappedPercent: string;
  isAllUnmapped: boolean;
  hasTelemetry: boolean;
}

export const EVIDENCE_REQUIREMENTS = [
  'Verified multi-class dataset label',
  'Explicit detection rule or signature',
  'Validated threat-intelligence evidence',
] as const;

export function formatMitreTelemetry(summary?: MitreTelemetrySummary | null): FormattedMitreTelemetry {
  if (!summary || typeof summary.total_alerts !== 'number') {
    return {
      totalAlerts: '0',
      mappedAlerts: '0',
      unmappedAlerts: '0',
      mappedPercent: '0.0%',
      unmappedPercent: '100.0%',
      isAllUnmapped: true,
      hasTelemetry: false,
    };
  }

  const total = Math.max(0, summary.total_alerts);
  const mapped = Math.max(0, summary.mapped_alerts);
  const unmapped = Math.max(0, summary.unmapped_alerts);

  const mappedPct = total > 0 ? ((mapped / total) * 100).toFixed(1) : '0.0';
  const unmappedPct = total > 0 ? ((unmapped / total) * 100).toFixed(1) : '100.0';

  return {
    totalAlerts: total.toLocaleString(),
    mappedAlerts: mapped.toLocaleString(),
    unmappedAlerts: unmapped.toLocaleString(),
    mappedPercent: `${mappedPct}%`,
    unmappedPercent: `${unmappedPct}%`,
    isAllUnmapped: mapped === 0,
    hasTelemetry: true,
  };
}

export function isTechniqueAttributable(alert?: Alert | null): boolean {
  if (!alert) return false;
  // Binary inferences and anomalies cannot be attributed to a specific MITRE ID without explicit ID
  return Boolean(alert.mitre_technique_id && alert.mitre_technique_id.trim().length > 0);
}
