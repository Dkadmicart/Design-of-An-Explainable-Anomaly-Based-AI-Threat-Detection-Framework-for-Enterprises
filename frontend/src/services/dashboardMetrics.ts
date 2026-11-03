/**
 * SentinelAI - Dashboard Metrics & Traffic Classification Helpers
 *
 * Enforces scientific attribution integrity:
 * - Renames "Detection Rate" to "Attack Event Share" to accurately reflect
 *   predicted attack share rather than ground-truth recall/accuracy.
 * - Formats formula and denominator (attack flows / total flows).
 * - Reconciles classification distribution totals with KPI summary.
 */
import type { DashboardSummary, AttackDistribution } from '../types';

export interface FormattedAttackShare {
  value: string;
  description: string;
  isEvaluated: boolean;
}

export function formatAttackShare(summary?: DashboardSummary | null): FormattedAttackShare {
  if (!summary || typeof summary.total_events !== 'number' || summary.total_events === 0) {
    return {
      value: 'No Telemetry',
      description: 'No network flows analyzed yet',
      isEvaluated: false,
    };
  }

  const total = Math.max(0, summary.total_events);
  const attacks = Math.max(0, summary.suspicious_events);
  const rate = summary.attack_event_share ?? summary.detection_rate ?? ((attacks / total) * 100);

  return {
    value: `${rate.toFixed(1)}%`,
    description: `${attacks.toLocaleString()} attacks / ${total.toLocaleString()} analyzed flows`,
    isEvaluated: true,
  };
}

export function reconcileTrafficDistribution(
  summary?: DashboardSummary | null,
  distribution?: AttackDistribution[] | null
): { isReconciled: boolean; totalDistribution: number } {
  if (!summary || !distribution) {
    return { isReconciled: false, totalDistribution: 0 };
  }

  const distTotal = distribution.reduce((acc, item) => acc + (item.count || 0), 0);
  return {
    isReconciled: distTotal === summary.total_events,
    totalDistribution: distTotal,
  };
}

