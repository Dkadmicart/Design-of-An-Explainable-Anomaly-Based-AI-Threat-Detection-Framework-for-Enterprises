import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';
import {
  AlertTriangle, Activity, Zap, Eye, Clock, ShieldCheck, Play, ArrowRight
} from 'lucide-react';
import clsx from 'clsx';
import { api } from '../services/api';
import type { DashboardSummary, Alert, AttackDistribution, ModelStatusInfo, TopSource, RiskDistribution } from '../types';
import { PageContainer, PageHeader } from '../components/common/PageContainer';
import { Card } from '../components/common/Card';
import { EmptyState } from '../components/common/EmptyState';
import { DataTable } from '../components/common/DataTable';
import { Badge, SeverityBadge } from '../components/common/Badge';

// ─── Primary Security Summary KPI Card Component ─────────────────────────────

interface KPICardProps {
  label: string;
  value: string | number;
  icon: React.ElementType;
  description: string;
  highlight?: 'critical' | 'warning' | 'normal';
}

function KPICard({ label, value, icon: Icon, description, highlight }: KPICardProps) {
  const isStringValue = typeof value === 'string' && isNaN(Number(value));

  return (
    <Card
      hover
      p-5
      className={clsx(
        'h-full flex flex-col justify-between',
        highlight === 'critical' && 'border-l-4 border-l-red-500 bg-gradient-to-br from-white to-red-50/30',
        highlight === 'warning' && 'border-l-4 border-l-amber-500 bg-gradient-to-br from-white to-amber-50/30'
      )}
    >
      <div>
        <div className="flex items-center justify-between gap-2 mb-3">
          <span className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">
            {label}
          </span>
          <div className={clsx(
            'w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0',
            highlight === 'critical' ? 'bg-red-50 text-red-600 border border-red-200' :
            highlight === 'warning' ? 'bg-amber-50 text-amber-600 border border-amber-200' :
            'bg-slate-100 text-slate-700 border border-slate-200'
          )}>
            <Icon size={18} strokeWidth={2.2} />
          </div>
        </div>

        <div className="flex items-baseline justify-start gap-2 mt-1 min-h-[44px]">
          {isStringValue ? (
            <span className="inline-flex items-center px-3 py-1 rounded-lg text-xs font-bold text-slate-500 bg-slate-100 border border-slate-200/80">
              {value}
            </span>
          ) : (
            <span className={clsx(
              'kpi-value text-3xl lg:text-4xl font-extrabold tracking-tight',
              highlight === 'critical' ? 'text-red-600' : 'text-slate-900'
            )}>
              {typeof value === 'number' ? value.toLocaleString() : value}
            </span>
          )}
        </div>
      </div>

      <p className="text-xs text-slate-500 font-medium mt-4 pt-3 border-t border-slate-100">
        {description}
      </p>
    </Card>
  );
}

// ─── Color Palettes ─────────────────────────────────────────────────────────

const ATTACK_COLORS: Record<string, string> = {
  BENIGN: '#CBD5E1',
  DDoS: '#EF4444',
  DoS: '#F59E0B',
  PortScan: '#3B82F6',
  Botnet: '#8B5CF6',
  'Brute Force': '#EC4899',
  'Web Attack': '#F97316',
  Infiltration: '#06B6D4',
};

const RISK_COLORS: Record<string, string> = {
  LOW: '#16A34A',
  MEDIUM: '#F5B700',
  HIGH: '#F59E0B',
  CRITICAL: '#DC2626',
};

export default function DashboardPage() {
  const navigate = useNavigate();
  const [summary, setSummary] = useState<DashboardSummary>({
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
  });
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [attacks, setAttacks] = useState<AttackDistribution[]>([]);

  useEffect(() => {
    api.getDashboardSummary().then(setSummary).catch(console.error);
    api.getAlerts({ page_size: 6 }).then(res => setAlerts(res.alerts)).catch(console.error);
    api.getAttackDistribution().then(res => setAttacks(res.distribution.filter(a => a.type !== 'BENIGN'))).catch(console.error);
  }, []);

  const timeline: { time: string; normal: number; suspicious: number; critical: number }[] = [];
  const sources: TopSource[] = [];
  const modelStatus: ModelStatusInfo = {
    current_model: 'Random Forest Baseline',
    version: 'v1.0.0',
    last_trained: 'Not Evaluated',
    detection_mode: 'Binary Classification',
    health: 'healthy',
  };

  const risks: RiskDistribution[] = [
    { category: 'LOW', count: alerts.filter(a => a.severity === 'LOW').length },
    { category: 'MEDIUM', count: alerts.filter(a => a.severity === 'MEDIUM').length },
    { category: 'HIGH', count: alerts.filter(a => a.severity === 'HIGH').length },
    { category: 'CRITICAL', count: alerts.filter(a => a.severity === 'CRITICAL').length },
  ];

  return (
    <PageContainer>
      {/* Page Header */}
      <PageHeader
        title="Security Operations Overview"
        subtitle="Monitor network activity, identify threats, and investigate security incidents."
        actions={
          <div className="flex items-center gap-2 text-xs font-bold text-slate-700 bg-white px-3.5 py-2 rounded-xl border border-slate-200 shadow-2xs">
            <Clock size={15} className="text-slate-400" />
            <span>Updated: {new Date().toLocaleTimeString()}</span>
          </div>
        }
      />

      {/* Primary Security Summary (4 Key KPI Cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 lg:gap-6">
        <KPICard
          label="Critical Alerts"
          value={summary.critical_alerts}
          icon={Zap}
          description="Incidents requiring immediate triage"
          highlight="critical"
        />
        <KPICard
          label="High Risk Events"
          value={summary.suspicious_events}
          icon={AlertTriangle}
          description="High severity flow anomalies"
          highlight="warning"
        />
        <KPICard
          label="Total Events"
          value={summary.total_events}
          icon={Activity}
          description="Network flows analyzed"
        />
        <KPICard
          label="Detection Rate"
          value={summary.detection_rate > 0 ? `${summary.detection_rate}%` : 'Not Evaluated'}
          icon={Eye}
          description="Awaiting pipeline evaluation"
        />
      </div>

      {/* Threat Activity Timeline & Attack Distribution Donut */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 lg:gap-8 items-stretch">
        {/* Threat Activity Timeline */}
        <Card p-6 className="xl:col-span-2 h-full flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="card-title">Threat Activity Timeline</h3>
              <p className="text-xs text-slate-500 mt-0.5">24-hour event volume (Normal vs Suspicious vs Critical)</p>
            </div>
          </div>
          
          {timeline.length > 0 ? (
            <div className="h-[240px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={timeline} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                  <XAxis dataKey="time" tick={{ fontSize: 11 }} stroke="#94A3B8" />
                  <YAxis tick={{ fontSize: 11 }} stroke="#94A3B8" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#FFFFFF',
                      border: '1px solid #E2E8F0',
                      borderRadius: '12px',
                      fontSize: '13px',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                    }}
                  />
                  <Area type="monotone" dataKey="normal" stackId="1" stroke="#94A3B8" fill="#F1F5F9" name="Normal Traffic" />
                  <Area type="monotone" dataKey="suspicious" stackId="1" stroke="#F5B700" fill="#FEF3C7" name="Suspicious Activity" />
                  <Area type="monotone" dataKey="critical" stackId="1" stroke="#EF4444" fill="#FEE2E2" name="Critical Events" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyState
              icon={Activity}
              title="No Telemetry Available"
              description="No network telemetry is currently being processed in the pipeline."
              action={{ label: 'Start Dataset Replay', onClick: () => navigate('/live-monitor'), icon: Play }}
              variant="amber"
              minHeight="min-h-[240px]"
            />
          )}
        </Card>

        {/* Attack Vector Distribution Donut */}
        <Card p-6 className="h-full flex flex-col justify-between">
          <div>
            <h3 className="card-title">Attack Vector Distribution</h3>
            <p className="text-xs text-slate-500 mt-0.5">Categorized attack classifications</p>
          </div>

          {attacks.length > 0 ? (
            <>
              <div className="h-[180px] w-full my-2">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={attacks}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={3}
                      dataKey="count"
                      nameKey="type"
                    >
                      {attacks.map((entry) => (
                        <Cell key={entry.type} fill={ATTACK_COLORS[entry.type] || '#94A3B8'} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value: any) => (value ?? 0).toLocaleString()}
                      contentStyle={{
                        backgroundColor: '#FFFFFF',
                        border: '1px solid #E2E8F0',
                        borderRadius: '10px',
                        fontSize: '13px',
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs pt-3 border-t border-slate-100">
                {attacks.map((a) => (
                  <div key={a.type} className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: ATTACK_COLORS[a.type] }} />
                      <span className="text-slate-600 truncate font-medium">{a.type}</span>
                    </div>
                    <span className="font-bold text-slate-900 ml-1">{a.percentage}%</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <EmptyState
              icon={ShieldCheck}
              title="No Threats Detected"
              description="Threat classification will appear when telemetry is processed."
              action={{ label: 'Open Live Monitor', onClick: () => navigate('/live-monitor'), variant: 'secondary' }}
              variant="emerald"
              minHeight="min-h-[240px]"
            />
          )}
        </Card>
      </div>

      {/* Threat Risk Summary & Recent Security Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Threat Risk Summary Horizontal Bars */}
        <Card p-6 className="lg:col-span-1 flex flex-col justify-between">
          <div>
            <h3 className="card-title mb-1">Threat Risk Summary</h3>
            <p className="text-xs text-slate-500 mb-5">Event severity scores breakdown</p>
            <div className="space-y-4">
              {risks.map((r) => {
                const total = risks.reduce((s, x) => s + x.count, 0);
                const pct = total > 0 ? ((r.count / total) * 100).toFixed(0) : '0';
                return (
                  <div key={r.category} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs font-semibold">
                      <span className="text-slate-600">{r.category}</span>
                      <span className="text-slate-900 font-bold">{r.count.toLocaleString()} <span className="text-slate-400 font-normal">({pct}%)</span></span>
                    </div>
                    <div className="progress-bar">
                      <div
                        className="progress-bar-fill"
                        style={{
                          width: `${pct}%`,
                          backgroundColor: RISK_COLORS[r.category],
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="mt-6 pt-4 border-t border-slate-100 text-xs text-slate-400 font-medium">
            Calculated dynamically based on anomaly confidence and severity rules.
          </div>
        </Card>

        {/* Recent Security Alerts Table */}
        <Card p-6 className="lg:col-span-3">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="card-title">Recent Security Alerts</h3>
              <p className="text-xs text-slate-500">Click any alert row to open investigation workspace</p>
            </div>
            <button
              onClick={() => navigate('/alerts')}
              className="text-xs font-bold text-[#B45309] hover:underline flex items-center gap-1 cursor-pointer"
            >
              <span>View All Alerts</span>
              <ArrowRight size={14} />
            </button>
          </div>

          {alerts.length === 0 ? (
            <EmptyState
              icon={ShieldCheck}
              title="No Security Alerts"
              description="No security alerts have been generated yet."
              action={{ label: 'Go to Live Monitor', onClick: () => navigate('/live-monitor'), variant: 'secondary' }}
              variant="emerald"
              minHeight="min-h-[220px]"
            />
          ) : (
            <DataTable>
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Severity</th>
                  <th>Detection</th>
                  <th>Source IP</th>
                  <th>Destination IP</th>
                  <th>Risk Score</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {alerts.slice(0, 6).map((alert) => (
                  <tr
                    key={alert.id}
                    className={clsx(
                      'cursor-pointer group hover:bg-slate-50',
                      alert.severity === 'CRITICAL' && 'row-critical',
                      alert.severity === 'HIGH' && 'row-high'
                    )}
                    onClick={() => navigate(`/alerts/${alert.id}`)}
                  >
                    <td className="text-xs font-mono text-slate-500 whitespace-nowrap">
                      {new Date(alert.created_at).toLocaleTimeString()}
                    </td>
                    <td><SeverityBadge severity={alert.severity} /></td>
                    <td className="text-xs font-bold text-slate-900">{alert.attack_type}</td>
                    <td className="text-xs font-mono font-bold text-slate-900">{alert.source_ip}</td>
                    <td className="text-xs font-mono text-slate-600">{alert.destination_ip}</td>
                    <td>
                      <span className={clsx(
                        'text-xs font-extrabold px-2 py-0.5 rounded',
                        alert.risk_score >= 75 ? 'bg-red-50 text-red-700' :
                        alert.risk_score >= 50 ? 'bg-amber-50 text-amber-700' :
                        'text-slate-600'
                      )}>
                        {alert.risk_score}
                      </span>
                    </td>
                    <td>
                      <Badge
                        variant={
                          alert.status === 'NEW' ? 'info' :
                          alert.status === 'RESOLVED' ? 'low' :
                          alert.status === 'ESCALATED' ? 'critical' : 'medium'
                        }
                      >
                        {alert.status}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </DataTable>
          )}
        </Card>
      </div>

      {/* Top Suspicious Sources & Active Model Status */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Suspicious Sources */}
        <Card p-6>
          <div className="mb-4">
            <h3 className="card-title">Top Suspicious Sources</h3>
            <p className="text-xs text-slate-500">Highest risk originating network addresses</p>
          </div>
          {sources.length === 0 ? (
            <EmptyState
              icon={Activity}
              title="Awaiting Network Telemetry"
              description="Awaiting network flow telemetry to identify suspicious origin addresses."
              variant="normal"
              minHeight="min-h-[180px]"
            />
          ) : (
            <DataTable>
              <thead>
                <tr>
                  <th>Source IP</th>
                  <th>Total Events</th>
                  <th>Risk Score</th>
                  <th>Last Seen</th>
                </tr>
              </thead>
              <tbody>
                {sources.map((s) => (
                  <tr key={s.ip}>
                    <td className="text-xs font-mono font-bold text-slate-900">{s.ip}</td>
                    <td className="text-xs font-semibold text-slate-600">{s.events} events</td>
                    <td>
                      <span className={clsx(
                        'text-xs font-extrabold px-2 py-0.5 rounded',
                        s.risk_score >= 75 ? 'bg-red-50 text-red-700' :
                        s.risk_score >= 50 ? 'bg-amber-50 text-amber-700' :
                        'text-slate-600'
                      )}>
                        {s.risk_score}
                      </span>
                    </td>
                    <td className="text-xs text-slate-500">
                      {new Date(s.last_seen).toLocaleTimeString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </DataTable>
          )}
        </Card>

        {/* Model Status Card */}
        <Card p-6 className="flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="card-title">Active ML Model Status</h3>
                <p className="text-xs text-slate-500">Detection engine operational status</p>
              </div>
              <Badge variant="low" className="flex items-center gap-1 px-3 py-1 text-xs">
                <span className="status-dot status-healthy pulse-dot" /> Operational
              </Badge>
            </div>

            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between py-2 border-b border-slate-100">
                <span className="text-xs font-semibold text-slate-500">Model Architecture</span>
                <span className="font-bold text-slate-900">{modelStatus.current_model}</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-slate-100">
                <span className="text-xs font-semibold text-slate-500">Version</span>
                <span className="font-mono font-bold text-slate-900">{modelStatus.version}</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-slate-100">
                <span className="text-xs font-semibold text-slate-500">Evaluation Status</span>
                <span className="text-xs font-medium text-slate-400 italic">Not Evaluated</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-slate-100">
                <span className="text-xs font-semibold text-slate-500">Detection Mode</span>
                <span className="font-semibold text-slate-900">{modelStatus.detection_mode}</span>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-xs font-semibold text-slate-500">Inference Service</span>
                <div className="flex items-center gap-2">
                  <span className="status-dot status-healthy" />
                  <span className="font-bold text-xs text-emerald-700 capitalize">{modelStatus.health}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
            <span>Baseline Supervised Classifier</span>
            <button onClick={() => navigate('/models')} className="font-bold text-[#B45309] hover:underline cursor-pointer">
              Models & Metrics →
            </button>
          </div>
        </Card>
      </div>
    </PageContainer>
  );
}
