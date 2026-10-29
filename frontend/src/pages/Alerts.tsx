import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Filter, ArrowUpDown, ShieldCheck, Play } from 'lucide-react';
import clsx from 'clsx';
import { api } from '../services/api';
import type { Alert, SeverityLevel, AlertStatus } from '../types';
import { PageContainer, PageHeader } from '../components/common/PageContainer';
import { Card } from '../components/common/Card';
import { EmptyState } from '../components/common/EmptyState';
import { DataTable } from '../components/common/DataTable';
import { Badge, SeverityBadge } from '../components/common/Badge';

const SEVERITY_OPTIONS: (SeverityLevel | 'ALL')[] = ['ALL', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];
const STATUS_OPTIONS: (AlertStatus | 'ALL')[] = ['ALL', 'NEW', 'INVESTIGATING', 'CONFIRMED', 'RESOLVED', 'ESCALATED'];

export default function AlertsPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [severityFilter, setSeverityFilter] = useState<SeverityLevel | 'ALL'>('ALL');
  const [statusFilter, setStatusFilter] = useState<AlertStatus | 'ALL'>('ALL');
  const [activeTab, setActiveTab] = useState<'ALL' | SeverityLevel>('ALL');
  const [alerts, setAlerts] = useState<Alert[]>([]);

  useEffect(() => {
    api.getAlerts({ page_size: 100 })
      .then(res => setAlerts(res.alerts))
      .catch(console.error);
  }, []);

  const filteredAlerts = useMemo(() => {
    return alerts.filter((alert) => {
      if (activeTab !== 'ALL' && alert.severity !== activeTab) return false;
      if (severityFilter !== 'ALL' && alert.severity !== severityFilter) return false;
      if (statusFilter !== 'ALL' && alert.status !== statusFilter) return false;
      if (search) {
        const query = search.toLowerCase();
        return (
          alert.source_ip.toLowerCase().includes(query) ||
          alert.destination_ip.toLowerCase().includes(query) ||
          alert.attack_type.toLowerCase().includes(query) ||
          alert.id.toLowerCase().includes(query)
        );
      }
      return true;
    });
  }, [alerts, activeTab, severityFilter, statusFilter, search]);

  return (
    <PageContainer>
      {/* Header */}
      <PageHeader
        title="Security Alert Queue"
        subtitle="Filter, triage, and investigate detected security incident alerts"
        statusBadge={
          <Badge variant="neutral" className="px-3 py-1 text-xs font-bold uppercase tracking-wider">
            Alert Operations
          </Badge>
        }
      />

      {/* Navigation Tabs */}
      <div className="flex gap-1 border-b border-slate-200 overflow-x-auto min-w-0 max-w-full">
        {(['ALL', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={clsx('tab text-sm py-2.5 px-4 font-semibold', activeTab === tab && 'tab-active')}
          >
            {tab === 'ALL' ? 'All Alerts' : `${tab} Severity`}
          </button>
        ))}
      </div>

      {/* Filters Bar */}
      <Card padding="compact" className="flex flex-col md:flex-row items-center justify-between gap-4 min-w-0">
        {/* Search Input */}
        <div className="relative flex-1 w-full min-w-0">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Filter by IP address, attack category, or Alert ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input input-has-icon pr-3 text-xs py-2 bg-slate-50 focus:bg-white"
          />
        </div>

        {/* Dropdowns */}
        <div className="flex items-center gap-3 w-full md:w-auto flex-wrap sm:flex-nowrap min-w-0">
          <div className="flex items-center gap-1.5 min-w-[150px]">
            <Filter size={15} className="text-slate-500" />
            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value as SeverityLevel | 'ALL')}
              className="input select text-xs py-2 bg-slate-50 focus:bg-white"
            >
              {SEVERITY_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>Severity: {opt}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1.5 min-w-[150px]">
            <ArrowUpDown size={15} className="text-slate-500" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as AlertStatus | 'ALL')}
              className="input select text-xs py-2 bg-slate-50 focus:bg-white"
            >
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>Status: {opt}</option>
              ))}
            </select>
          </div>
        </div>
      </Card>

      {/* Alerts Table Card */}
      <Card p-6 className="min-w-0 overflow-hidden">
        <div className="flex items-center justify-between mb-4">
          <span className="text-xs font-bold text-slate-500">
            Showing {filteredAlerts.length} of {alerts.length} total alerts
          </span>
        </div>

        {filteredAlerts.length === 0 ? (
          <EmptyState
            icon={ShieldCheck}
            title="No Security Alerts"
            description="No alerts have been generated yet. Stream network flow telemetry to trigger anomaly detection."
            action={{ label: 'Open Live Monitor', onClick: () => navigate('/live-monitor'), icon: Play }}
            variant="emerald"
            minHeight="min-h-[260px]"
          />
        ) : (
          <DataTable>
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Alert ID</th>
                <th>Severity</th>
                <th>Source IP</th>
                <th>Destination IP</th>
                <th>Attack Category</th>
                <th>Risk Score</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredAlerts.map((alert) => (
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
                    {new Date(alert.created_at).toLocaleString()}
                  </td>
                  <td className="text-xs font-mono font-bold text-slate-900">{alert.id.slice(-8)}</td>
                  <td><SeverityBadge severity={alert.severity} /></td>
                  <td className="text-xs font-mono font-bold text-slate-900">{alert.source_ip}</td>
                  <td className="text-xs font-mono text-slate-600">{alert.destination_ip}</td>
                  <td className="text-xs font-bold text-slate-900">{alert.attack_type}</td>
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
                  <td>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/alerts/${alert.id}`);
                      }}
                      className="btn btn-secondary btn-sm text-xs py-1 px-2.5"
                    >
                      Investigate
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        )}
      </Card>
    </PageContainer>
  );
}
