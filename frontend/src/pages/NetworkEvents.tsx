import { useState, useEffect, useMemo } from 'react';
import { Search, Filter, Globe } from 'lucide-react';
import clsx from 'clsx';
import { api } from '../services/api';
import type { NetworkEvent } from '../types';
import { PageContainer, PageHeader } from '../components/common/PageContainer';
import { Card } from '../components/common/Card';
import { EmptyState } from '../components/common/EmptyState';
import { DataTable } from '../components/common/DataTable';
import { Badge } from '../components/common/Badge';

export default function NetworkEventsPage() {
  const [search, setSearch] = useState('');
  const [protocolFilter, setProtocolFilter] = useState<string>('ALL');
  const [events, setEvents] = useState<NetworkEvent[]>([]);

  const loadEvents = () => {
    api.getEvents({ page_size: 100 })
      .then(res => setEvents(res.events))
      .catch(console.error);
  };

  useEffect(() => {
    loadEvents();
  }, []);

  const filteredEvents = useMemo(() => {
    return events.filter((evt) => {
      if (protocolFilter !== 'ALL' && evt.protocol !== protocolFilter) return false;
      if (search) {
        const query = search.toLowerCase();
        return (
          evt.source_ip.toLowerCase().includes(query) ||
          evt.destination_ip.toLowerCase().includes(query) ||
          evt.attack_type.toLowerCase().includes(query) ||
          String(evt.destination_port).includes(query)
        );
      }
      return true;
    });
  }, [events, protocolFilter, search]);

  return (
    <PageContainer>
      {/* Page Header */}
      <PageHeader
        title="Network Flow Event Explorer"
        subtitle="Searchable network flow telemetry log — Query IPs, destination ports, protocols, and predictions"
        statusBadge={
          <Badge variant="neutral" className="px-3 py-1 text-xs font-bold uppercase tracking-wider">
            Flow Telemetry Log
          </Badge>
        }
      />

      {/* Filter Bar */}
      <Card padding="compact" className="flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="relative flex-1 w-full">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by Source IP, Destination IP, Port, or Attack type..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input input-has-icon pr-3 text-xs py-2 bg-slate-50 focus:bg-white"
          />
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="flex items-center gap-1.5 min-w-[140px]">
            <Filter size={15} className="text-slate-500" />
            <select
              value={protocolFilter}
              onChange={(e) => setProtocolFilter(e.target.value)}
              className="input select text-xs py-2 bg-slate-50 focus:bg-white"
            >
              <option value="ALL">Protocol: All</option>
              <option value="TCP">Protocol: TCP</option>
              <option value="UDP">Protocol: UDP</option>
              <option value="ICMP">Protocol: ICMP</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Network Flow Event Table Card */}
      <Card p-6>
        <div className="flex items-center justify-between mb-4">
          <span className="text-xs font-bold text-slate-500">
            Showing {filteredEvents.length} flow events
          </span>
        </div>

        {filteredEvents.length === 0 ? (
          <EmptyState
            icon={Globe}
            title="No Network Events Available"
            description="Zero network flow logs match your search filters or dataset replay is currently paused."
            variant="normal"
            minHeight="min-h-[260px]"
          />
        ) : (
          <DataTable>
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Source IP</th>
                <th>Destination IP</th>
                <th>Source Port</th>
                <th>Destination Port</th>
                <th>Protocol</th>
                <th>Flow Duration</th>
                <th>Total Packets</th>
                <th>Model Prediction</th>
                <th>Risk Score</th>
              </tr>
            </thead>
            <tbody>
              {filteredEvents.map((evt) => (
                <tr key={evt.id} className={clsx(evt.prediction !== 'BENIGN' && 'row-suspicious')}>
                  <td className="text-xs font-mono text-slate-500 whitespace-nowrap">
                    {new Date(evt.timestamp).toLocaleTimeString()}
                  </td>
                  <td className="text-xs font-mono font-bold text-slate-900">{evt.source_ip}</td>
                  <td className="text-xs font-mono text-slate-600">{evt.destination_ip}</td>
                  <td className="text-xs font-mono text-slate-600">{evt.source_port}</td>
                  <td className="text-xs font-mono text-slate-600">{evt.destination_port}</td>
                  <td className="text-xs font-bold text-slate-900">{evt.protocol}</td>
                  <td className="text-xs text-slate-600">{(evt.flow_duration / 1000).toFixed(1)}s</td>
                  <td className="text-xs text-slate-600">{evt.total_fwd_packets + evt.total_bwd_packets} pkts</td>
                  <td>
                    <Badge variant={evt.prediction === 'BENIGN' ? 'low' : 'critical'}>
                      {evt.prediction === 'BENIGN' ? 'Normal Traffic' : evt.attack_type}
                    </Badge>
                  </td>
                  <td>
                    <span className={clsx(
                      'text-xs font-extrabold px-2 py-0.5 rounded',
                      evt.risk_score >= 75 ? 'bg-red-50 text-red-700' :
                      evt.risk_score >= 50 ? 'bg-amber-50 text-amber-700' :
                      'text-slate-600'
                    )}>
                      {evt.risk_score}%
                    </span>
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
