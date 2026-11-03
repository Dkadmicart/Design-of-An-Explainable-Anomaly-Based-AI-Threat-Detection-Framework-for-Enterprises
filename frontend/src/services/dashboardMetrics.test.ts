/**
 * Unit & Regression Tests for Dashboard Metrics & Traffic Classification
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { formatAttackShare, reconcileTrafficDistribution } from './dashboardMetrics.ts';
import type { DashboardSummary, AttackDistribution } from '../types.ts';

describe('Dashboard Metrics & Attack Share Formulation', () => {
  it('returns graceful fallback when total_events is zero or summary is missing', () => {
    const emptySummary: DashboardSummary = {
      total_events: 0,
      normal_events: 0,
      suspicious_events: 0,
      critical_alerts: 0,
      detection_rate: 0,
      false_positive_rate: 0,
      total_events_trend: 0,
      normal_events_trend: 0,
      suspicious_events_trend: 0,
      critical_alerts_trend: 0,
      detection_rate_trend: 0,
      false_positive_rate_trend: 0,
    };

    const resEmpty = formatAttackShare(emptySummary);
    assert.strictEqual(resEmpty.value, 'No Telemetry');
    assert.strictEqual(resEmpty.description, 'No network flows analyzed yet');
    assert.strictEqual(resEmpty.isEvaluated, false);

    const resNull = formatAttackShare(null);
    assert.strictEqual(resNull.value, 'No Telemetry');
    assert.strictEqual(resNull.isEvaluated, false);
  });

  it('accurately formats attack event share with formula and denominator', () => {
    const summary: DashboardSummary = {
      total_events: 17796,
      normal_events: 15457,
      suspicious_events: 2339,
      critical_alerts: 2268,
      detection_rate: 13.14,
      attack_event_share: 13.14,
      false_positive_rate: 0,
      total_events_trend: 0,
      normal_events_trend: 0,
      suspicious_events_trend: 0,
      critical_alerts_trend: 0,
      detection_rate_trend: 0,
      false_positive_rate_trend: 0,
    };

    const formatted = formatAttackShare(summary);
    assert.strictEqual(formatted.value, '13.1%');
    assert.strictEqual(formatted.description, '2,339 attacks / 17,796 analyzed flows');
    assert.strictEqual(formatted.isEvaluated, true);
  });

  it('correctly handles 0 attacks among analyzed flows without collapsing to Not Evaluated', () => {
    const allBenignSummary: DashboardSummary = {
      total_events: 500,
      normal_events: 500,
      suspicious_events: 0,
      critical_alerts: 0,
      detection_rate: 0.0,
      attack_event_share: 0.0,
      false_positive_rate: 0,
      total_events_trend: 0,
      normal_events_trend: 0,
      suspicious_events_trend: 0,
      critical_alerts_trend: 0,
      detection_rate_trend: 0,
      false_positive_rate_trend: 0,
    };

    const formatted = formatAttackShare(allBenignSummary);
    assert.strictEqual(formatted.value, '0.0%');
    assert.strictEqual(formatted.description, '0 attacks / 500 analyzed flows');
    assert.strictEqual(formatted.isEvaluated, true);
  });

  it('reconciles traffic distribution counts against total_events', () => {
    const summary: DashboardSummary = {
      total_events: 17796,
      normal_events: 15457,
      suspicious_events: 2339,
      critical_alerts: 2268,
      detection_rate: 13.14,
      false_positive_rate: 0,
      total_events_trend: 0,
      normal_events_trend: 0,
      suspicious_events_trend: 0,
      critical_alerts_trend: 0,
      detection_rate_trend: 0,
      false_positive_rate_trend: 0,
    };

    const distribution: AttackDistribution[] = [
      { type: 'BENIGN', count: 15457, percentage: 86.86 },
      { type: 'ATTACK', count: 2339, percentage: 13.14 },
    ];

    const { isReconciled, totalDistribution } = reconcileTrafficDistribution(summary, distribution);
    assert.strictEqual(isReconciled, true);
    assert.strictEqual(totalDistribution, 17796);
  });
});

