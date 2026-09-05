import { Database, Upload, CheckCircle, FileText, ExternalLink, Play } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { PageContainer, PageHeader } from '../components/common/PageContainer';
import { Card } from '../components/common/Card';
import { DataTable } from '../components/common/DataTable';
import { Badge } from '../components/common/Badge';

const cicFiles = [
  { name: 'Benign-Monday-no-metadata.parquet', scenario: 'Benign Baseline Traffic', attack_types: ['BENIGN'], status: 'Available' },
  { name: 'Botnet-Friday-no-metadata.parquet', scenario: 'Botnet C2 Traffic', attack_types: ['Botnet', 'BENIGN'], status: 'Available' },
  { name: 'Bruteforce-Tuesday-no-metadata.parquet', scenario: 'SSH & FTP Brute Force Attacks', attack_types: ['Brute Force', 'BENIGN'], status: 'Available' },
  { name: 'DDoS-Friday-no-metadata.parquet', scenario: 'DDoS Volumetric Attacks', attack_types: ['DDoS', 'BENIGN'], status: 'Available' },
  { name: 'DoS-Wednesday-no-metadata.parquet', scenario: 'DoS Attacks (Slowloris, Hulk)', attack_types: ['DoS', 'BENIGN'], status: 'Available' },
  { name: 'Infiltration-Thursday-no-metadata.parquet', scenario: 'Infiltration & Privilege Escalation', attack_types: ['Infiltration', 'BENIGN'], status: 'Available' },
  { name: 'Portscan-Friday-no-metadata.parquet', scenario: 'Port Scanning & Reconnaissance', attack_types: ['PortScan', 'BENIGN'], status: 'Available' },
  { name: 'WebAttacks-Thursday-no-metadata.parquet', scenario: 'Web Application Attacks', attack_types: ['Web Attack', 'BENIGN'], status: 'Available' },
];

export default function DatasetsPage() {
  const navigate = useNavigate();

  return (
    <PageContainer>
      {/* Page Header */}
      <PageHeader
        title="Dataset Management"
        subtitle="CIC-IDS2017 dataset file inventory, validation status, and replay configuration"
        statusBadge={
          <Badge variant="neutral" className="px-3 py-1 text-xs font-bold uppercase tracking-wider">
            Dataset Inventory
          </Badge>
        }
        actions={
          <button className="btn btn-primary btn-sm font-bold">
            <Upload size={15} /> Import Dataset File
          </button>
        }
      />

      {/* Dataset Metadata Overview Card */}
      <Card p-6 className="border-l-4 border-l-[#F5B700]">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center flex-shrink-0">
              <Database size={20} className="text-[#B45309]" />
            </div>
            <div>
              <h2 className="card-title text-lg">CIC-IDS2017 Benchmark Dataset</h2>
              <span className="text-xs text-slate-500 font-medium">Canadian Institute for Cybersecurity (University of New Brunswick)</span>
            </div>
          </div>
          <a
            href="https://www.unb.ca/cic/datasets/ids-2017.html"
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-secondary btn-sm text-xs self-start md:self-auto"
          >
            <ExternalLink size={14} /> Official Dataset Portal
          </a>
        </div>
        <p className="text-xs text-slate-600 leading-relaxed mb-5 font-medium">
          Contains labeled network flow telemetry captured over 5 days in 2017. Includes benign baseline traffic alongside real-world attack scenarios including DDoS, DoS, Brute Force, Web Attacks, Botnet communication, Port Scanning, and Infiltration.
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 border-t border-slate-100 text-xs">
          <div>
            <span className="text-[10.5px] font-extrabold text-slate-400 uppercase tracking-wider block">Source Organization</span>
            <p className="font-bold text-slate-900 mt-0.5">UNB Cybersecurity Institute</p>
          </div>
          <div>
            <span className="text-[10.5px] font-extrabold text-slate-400 uppercase tracking-wider block">Ingestion Format</span>
            <p className="font-semibold text-slate-900 mt-0.5">PyArrow / Parquet Streamer</p>
          </div>
          <div>
            <span className="text-[10.5px] font-extrabold text-slate-400 uppercase tracking-wider block">Preprocessing Status</span>
            <p className="font-semibold text-emerald-700 mt-0.5">Preprocessed Files Ready</p>
          </div>
          <div>
            <span className="text-[10.5px] font-extrabold text-slate-400 uppercase tracking-wider block">Tracked Files</span>
            <p className="font-bold text-slate-900 mt-0.5">{cicFiles.length} Parquet Files</p>
          </div>
        </div>
      </Card>

      {/* Dataset Parquet Files Table Card */}
      <Card p-6>
        <div className="mb-4">
          <h3 className="card-title">Parquet File Inventory</h3>
          <p className="text-xs text-slate-500 mt-0.5">CIC-IDS2017 daily scenario captures ready for dataset replay engine</p>
        </div>

        <DataTable>
          <thead>
            <tr>
              <th>File Name</th>
              <th>Scenario Description</th>
              <th>Features</th>
              <th>Attack Categories</th>
              <th>Validation Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {cicFiles.map((file) => (
              <tr key={file.name}>
                <td className="text-xs font-mono font-bold max-w-[240px] truncate text-slate-900" title={file.name}>
                  {file.name}
                </td>
                <td className="text-xs font-semibold text-slate-700">{file.scenario}</td>
                <td className="text-xs text-slate-500 font-mono">
                  78 features
                </td>
                <td>
                  <div className="flex flex-wrap gap-1">
                    {file.attack_types.map(t => (
                      <Badge key={t} variant="info" className="text-[10.5px]">{t}</Badge>
                    ))}
                  </div>
                </td>
                <td>
                  <Badge variant="low" className="text-[10.5px]">Validated</Badge>
                </td>
                <td>
                  <button
                    onClick={() => navigate('/live-monitor')}
                    className="btn btn-primary btn-sm text-[11px] py-1 px-2.5 font-bold"
                  >
                    <Play size={12} /> Start Replay
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </DataTable>
      </Card>

      {/* Dataset Operations Bar */}
      <Card padding="compact" className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button className="btn btn-secondary btn-sm font-semibold">
            <CheckCircle size={14} className="text-emerald-600" /> Validate Files
          </button>
          <button className="btn btn-secondary btn-sm font-semibold">
            <FileText size={14} /> Run Feature Analysis
          </button>
        </div>
        <p className="text-xs text-slate-400 font-medium">
          Dataset directory: <code className="font-mono bg-slate-100 px-2 py-0.5 rounded border border-slate-200">data/processed/</code>
        </p>
      </Card>
    </PageContainer>
  );
}
