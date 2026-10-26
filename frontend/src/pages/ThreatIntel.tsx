import { useState, useEffect } from 'react';
import { Shield } from 'lucide-react';
import clsx from 'clsx';
import { api } from '../services/api';
import type { TopSource } from '../types';
import { PageContainer, PageHeader } from '../components/common/PageContainer';
import { Card } from '../components/common/Card';
import { EmptyState } from '../components/common/EmptyState';
import { DataTable } from '../components/common/DataTable';
import { Badge } from '../components/common/Badge';

export default function ThreatIntelPage() {
  const [iocs, setIocs] = useState<TopSource[]>([]);

  useEffect(() => {
    api.getAlerts({ page_size: 50 }).then(res => {
      const ipMap: Record<string, { events: number; maxRisk: number; lastSeen: string }> = {};
      res.alerts.forEach(a => {
        if (!ipMap[a.source_ip]) {
          ipMap[a.source_ip] = { events: 0, maxRisk: 0, lastSeen: a.created_at };
        }
        ipMap[a.source_ip].events += 1;
        ipMap[a.source_ip].maxRisk = Math.max(ipMap[a.source_ip].maxRisk, a.risk_score);
      });
      const topSources: TopSource[] = Object.entries(ipMap).map(([ip, data]) => ({
        ip,
        events: data.events,
        risk_score: data.maxRisk,
        last_seen: data.lastSeen,
      }));
      setIocs(topSources);
    }).catch(console.error);
  }, []);

  return (
    <PageContainer>
      {/* Page Header */}
      <PageHeader
        title="Threat Intelligence"
        subtitle="Indicators of Compromise (IOCs), suspicious network endpoints, and threat feeds"
        statusBadge={
          <Badge variant="neutral" className="px-3 py-1 text-xs font-bold uppercase tracking-wider">
            Threat Intelligence
          </Badge>
        }
      />

      {/* Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <Card padding="compact">
          <span className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider block">Observed High-Risk IPs</span>
          <p className="text-2xl font-extrabold text-red-600 mt-1">{iocs.length} Addresses</p>
          <p className="text-xs text-slate-500 font-medium mt-1">Flagged in telemetry logs</p>
        </Card>
        <Card padding="compact">
          <span className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider block">STIX/TAXII Threat Feed</span>
          <p className="text-lg font-extrabold text-slate-900 mt-1">Not Connected</p>
          <p className="text-xs text-slate-400 font-medium mt-1 italic">Awaiting threat feed integration</p>
        </Card>
        <Card padding="compact">
          <span className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider block">Attack Signatures</span>
          <p className="text-2xl font-extrabold text-slate-900 mt-1">7 Categories</p>
          <p className="text-xs text-slate-500 font-medium mt-1">Attack taxonomy profiles</p>
        </Card>
      </div>

      {/* Observed IOC Table Card */}
      <Card padding="normal">
        <div className="mb-4">
          <h3 className="card-title">High-Risk Indicators of Compromise</h3>
          <p className="text-xs text-slate-500 mt-0.5">Endpoints exhibiting anomalous flow patterns</p>
        </div>

        {iocs.length === 0 ? (
          <EmptyState
            icon={Shield}
            title="No Threat Indicators Logged"
            description="No high-risk indicators of compromise recorded in the current telemetry window."
            variant="normal"
            minHeight="min-h-[240px]"
          />
        ) : (
          <DataTable>
            <thead>
              <tr>
                <th>IP Address</th>
                <th>Reputation Score</th>
                <th>Observed Events</th>
                <th>Last Seen</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {iocs.map((ioc) => (
                <tr key={ioc.ip}>
                  <td className="text-xs font-mono font-bold text-slate-900">{ioc.ip}</td>
                  <td>
                    <span className={clsx(
                      'text-xs font-extrabold px-2.5 py-0.5 rounded',
                      ioc.risk_score >= 75 ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'
                    )}>
                      Risk {ioc.risk_score}/100
                    </span>
                  </td>
                  <td className="text-xs font-semibold text-slate-700">{ioc.events} flows</td>
                  <td className="text-xs text-slate-500">{new Date(ioc.last_seen).toLocaleTimeString()}</td>
                  <td>
                    <button className="btn btn-secondary btn-sm text-xs py-1 px-2.5">
                      Lookup IP
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
