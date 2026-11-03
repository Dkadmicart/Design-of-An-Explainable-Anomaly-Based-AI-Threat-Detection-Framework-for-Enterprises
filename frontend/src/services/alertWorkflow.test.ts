/**
 * Unit & Regression Tests for Alert Lifecycle & Action Workflow Mapping
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { AlertStatus, SeverityLevel } from '../types.ts';

// Action mapping helper matching AlertInvestigation.tsx logic
export function mapActionToBackendStatus(action: string): AlertStatus {
  const norm = action.trim().toUpperCase();
  if (norm === 'FALSE_POSITIVE' || norm === 'BENIGN') {
    return 'BENIGN';
  }
  if (norm === 'INVESTIGATING') {
    return 'INVESTIGATING';
  }
  if (norm === 'CONFIRMED') {
    return 'CONFIRMED';
  }
  if (norm === 'RESOLVED') {
    return 'RESOLVED';
  }
  if (norm === 'ESCALATED') {
    return 'ESCALATED';
  }
  return 'NEW';
}

export function getSeverityBand(riskScore: number): SeverityLevel {
  if (riskScore >= 75.0) return 'CRITICAL';
  if (riskScore >= 50.0) return 'HIGH';
  if (riskScore >= 25.0) return 'MEDIUM';
  return 'LOW';
}

describe('Alert Lifecycle & Action Workflow Mapping', () => {
  it('maps UI actions to database-supported AlertStatus values', () => {
    assert.strictEqual(mapActionToBackendStatus('INVESTIGATING'), 'INVESTIGATING');
    assert.strictEqual(mapActionToBackendStatus('CONFIRMED'), 'CONFIRMED');
    assert.strictEqual(mapActionToBackendStatus('RESOLVED'), 'RESOLVED');
    assert.strictEqual(mapActionToBackendStatus('ESCALATED'), 'ESCALATED');
    assert.strictEqual(mapActionToBackendStatus('FALSE_POSITIVE'), 'BENIGN');
    assert.strictEqual(mapActionToBackendStatus('BENIGN'), 'BENIGN');
    assert.strictEqual(mapActionToBackendStatus('UNKNOWN_ACTION'), 'NEW');
  });

  it('verifies severity band boundaries across [0, 100] risk scale', () => {
    assert.strictEqual(getSeverityBand(100.0), 'CRITICAL');
    assert.strictEqual(getSeverityBand(75.0), 'CRITICAL');
    assert.strictEqual(getSeverityBand(74.9), 'HIGH');
    assert.strictEqual(getSeverityBand(50.0), 'HIGH');
    assert.strictEqual(getSeverityBand(49.9), 'MEDIUM');
    assert.strictEqual(getSeverityBand(25.0), 'MEDIUM');
    assert.strictEqual(getSeverityBand(24.9), 'LOW');
    assert.strictEqual(getSeverityBand(0.0), 'LOW');
  });
});

