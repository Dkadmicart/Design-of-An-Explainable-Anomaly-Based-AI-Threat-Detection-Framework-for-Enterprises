/**
 * Unit & Regression Tests for MITRE Attribution & Telemetry Helpers
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  formatMitreTelemetry,
  isTechniqueAttributable,
  EVIDENCE_REQUIREMENTS,
} from './mitreAttribution.ts';
import type { Alert, MitreTelemetrySummary } from '../types.ts';

describe('MITRE ATT&CK Attribution & Telemetry Helpers', () => {
  it('returns graceful fallback when telemetry summary is null or undefined', () => {
    const formattedNull = formatMitreTelemetry(null);
    assert.strictEqual(formattedNull.hasTelemetry, false);
    assert.strictEqual(formattedNull.totalAlerts, '0');
    assert.strictEqual(formattedNull.mappedAlerts, '0');
    assert.strictEqual(formattedNull.unmappedAlerts, '0');
    assert.strictEqual(formattedNull.isAllUnmapped, true);

    const formattedUndef = formatMitreTelemetry(undefined);
    assert.strictEqual(formattedUndef.hasTelemetry, false);
    assert.strictEqual(formattedUndef.isAllUnmapped, true);
  });

  it('accurately formats valid database telemetry with 100% unmapped replay traffic', () => {
    const summary: MitreTelemetrySummary = {
      total_alerts: 2040,
      mapped_alerts: 0,
      unmapped_alerts: 2040,
      classification_scope: 'Binary Anomaly Detection (BENIGN vs ATTACK)',
      evidence_note: 'Binary inference without payload evidence remains Unmapped.',
    };

    const formatted = formatMitreTelemetry(summary);
    assert.strictEqual(formatted.hasTelemetry, true);
    assert.strictEqual(formatted.totalAlerts, '2,040');
    assert.strictEqual(formatted.mappedAlerts, '0');
    assert.strictEqual(formatted.unmappedAlerts, '2,040');
    assert.strictEqual(formatted.mappedPercent, '0.0%');
    assert.strictEqual(formatted.unmappedPercent, '100.0%');
    assert.strictEqual(formatted.isAllUnmapped, true);
  });

  it('accurately calculates percentages when mapped alerts exist', () => {
    const summary: MitreTelemetrySummary = {
      total_alerts: 100,
      mapped_alerts: 25,
      unmapped_alerts: 75,
      classification_scope: 'Binary Anomaly Detection (BENIGN vs ATTACK)',
      evidence_note: 'Test',
    };

    const formatted = formatMitreTelemetry(summary);
    assert.strictEqual(formatted.totalAlerts, '100');
    assert.strictEqual(formatted.mappedAlerts, '25');
    assert.strictEqual(formatted.unmappedAlerts, '75');
    assert.strictEqual(formatted.mappedPercent, '25.0%');
    assert.strictEqual(formatted.unmappedPercent, '75.0%');
    assert.strictEqual(formatted.isAllUnmapped, false);
  });

  it('verifies that generic binary predictions without mitre_technique_id are not attributable', () => {
    const binaryAlert: Alert = {
      id: 'alert-1',
      event_id: 'evt-1',
      severity: 'CRITICAL' as any,
      attack_type: 'ATTACK',
      status: 'NEW' as any,
      risk_score: 85.5,
      confidence: 0.94,
      detection_model: 'xgboost_threat_detector',
      detection_reason: 'Anomaly detected',
      mitre_tactic: null,
      mitre_technique_id: null,
      mitre_technique_name: null,
      source_ip: '172.16.0.1',
      destination_ip: '192.168.10.50',
      source_port: 50000,
      destination_port: 80,
      protocol: 'TCP',
      first_seen: new Date().toISOString(),
      last_seen: new Date().toISOString(),
      created_at: new Date().toISOString(),
    };

    assert.strictEqual(isTechniqueAttributable(binaryAlert), false);
    assert.strictEqual(isTechniqueAttributable(null), false);
    assert.strictEqual(isTechniqueAttributable(undefined), false);

    // When mitre_technique_id is legitimately assigned
    const attributedAlert = { ...binaryAlert, mitre_technique_id: 'T1498' };
    assert.strictEqual(isTechniqueAttributable(attributedAlert), true);
  });

  it('exports the standard 3 attribution requirements', () => {
    assert.strictEqual(EVIDENCE_REQUIREMENTS.length, 3);
    assert.strictEqual(EVIDENCE_REQUIREMENTS[0], 'Verified multi-class dataset label');
    assert.strictEqual(EVIDENCE_REQUIREMENTS[1], 'Explicit detection rule or signature');
    assert.strictEqual(EVIDENCE_REQUIREMENTS[2], 'Validated threat-intelligence evidence');
  });
});
