import { useState, useEffect } from 'react';
import {
  Database, CheckCircle2, AlertTriangle, XCircle, RefreshCw,
  FileText, ExternalLink, Play, Search, HardDrive, ShieldAlert,
  BarChart3, Info
} from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell } from 'recharts';

import { PageContainer, PageHeader } from '../components/common/PageContainer';
import { Card } from '../components/common/Card';
import { DataTable } from '../components/common/DataTable';
import { Badge } from '../components/common/Badge';
import { api } from '../services/api';
import type {
  DatasetRegistry, DatasetFileRecord, DatasetSchema, DataQualityReport,
  LabelDistribution, DatasetStatusType, DatasetFileStatusType
} from '../types';

const BAR_COLORS = ['#3B82F6', '#EF4444', '#F59E0B', '#8B5CF6', '#10B981', '#EC4899', '#6366F1', '#14B8A6'];

export default function DatasetsPage() {
  const [dataset, setDataset] = useState<DatasetRegistry | null>(null);
  const [files, setFiles] = useState<DatasetFileRecord[]>([]);
  const [schema, setSchema] = useState<DatasetSchema | null>(null);
  const [quality, setQuality] = useState<DataQualityReport | null>(null);
  const [labels, setLabels] = useState<LabelDistribution | null>(null);

  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  const [searchFeature, setSearchFeature] = useState('');
  const [selectedFileModal, setSelectedFileModal] = useState<DatasetFileRecord | null>(null);
  const [activeTab, setActiveTab] = useState<'inventory' | 'quality' | 'labels' | 'schema'>('inventory');

  const loadAllData = async () => {
    try {
      const [dsRes, filesRes, schemaRes, qualityRes, labelsRes] = await Promise.all([
        api.getDatasetDetails('cic-ids2017').catch(() => null),
        api.getDatasetFiles('cic-ids2017').catch(() => null),
        api.getDatasetSchema('cic-ids2017').catch(() => null),
        api.getDatasetQuality('cic-ids2017').catch(() => null),
        api.getDatasetLabels('cic-ids2017').catch(() => null),
      ]);

      if (dsRes?.dataset) setDataset(dsRes.dataset);
      if (filesRes?.files) setFiles(filesRes.files);
      if (schemaRes?.schema) setSchema(schemaRes.schema);
      if (qualityRes?.quality) setQuality(qualityRes.quality);
      if (labelsRes?.labels) setLabels(labelsRes.labels);
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to connect to dataset backend';
      setMessage({ type: 'error', text: errorMsg });
    }
  };

  useEffect(() => {
    loadAllData();
  }, []);

  const handleValidate = async () => {
    setActionLoading('validate');
    setMessage({ type: 'info', text: 'Validating dataset Parquet files...' });
    try {
      const res = await api.validateDataset('cic-ids2017');
      setMessage({ type: 'success', text: (res as { status?: string; message?: string }).message || 'Dataset validation finished.' });
      await loadAllData();
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Validation failed';
      setMessage({ type: 'error', text: errorMsg });
    } finally {
      setActionLoading(null);
    }
  };

  const handleProcess = async () => {
    setActionLoading('process');
    setMessage({ type: 'info', text: 'Running dataset preprocessing pipeline...' });
    try {
      await api.processDataset('cic-ids2017');
      setMessage({ type: 'success', text: 'Preprocessing pipeline executed successfully.' });
      await loadAllData();
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Preprocessing failed';
      setMessage({ type: 'error', text: errorMsg });
    } finally {
      setActionLoading(null);
    }
  };

  const handleRefresh = async () => {
    setActionLoading('refresh');
    try {
      await api.refreshDataset('cic-ids2017');
      setMessage({ type: 'success', text: 'Dataset state synchronized.' });
      await loadAllData();
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Refresh failed';
      setMessage({ type: 'error', text: errorMsg });
    } finally {
      setActionLoading(null);
    }
  };

  const getStatusBadge = (status?: DatasetStatusType) => {
    switch (status) {
      case 'READY':
      case 'PROCESSED':
        return <Badge variant="low" className="px-3 py-1 text-xs font-bold uppercase">READY / PROCESSED</Badge>;
      case 'VALIDATING':
      case 'PROCESSING':
        return <Badge variant="medium" className="px-3 py-1 text-xs font-bold uppercase">PROCESSING</Badge>;
      case 'ERROR':
        return <Badge variant="critical" className="px-3 py-1 text-xs font-bold uppercase">ERROR</Badge>;
      case 'NOT_AVAILABLE':
      default:
        return <Badge variant="neutral" className="px-3 py-1 text-xs font-bold uppercase bg-amber-100 text-amber-900 border-amber-300">FILES NOT AVAILABLE</Badge>;
    }
  };

  const getFileStatusBadge = (status: DatasetFileStatusType) => {
    switch (status) {
      case 'VALID':
        return <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300"><CheckCircle2 size={13} /> Valid</span>;
      case 'INVALID':
        return <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 border border-rose-300"><XCircle size={13} /> Invalid</span>;
      case 'PROCESSING':
        return <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-300"><RefreshCw size={13} className="animate-spin" /> Processing</span>;
      case 'NOT_FOUND':
      default:
        return <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-300"><AlertTriangle size={13} className="text-amber-500" /> Not Found</span>;
    }
  };

  const filteredFeatures = (schema?.features || []).filter((f) =>
    f.name.toLowerCase().includes(searchFeature.toLowerCase()) ||
    f.data_type.toLowerCase().includes(searchFeature.toLowerCase())
  );

  const isNotAvailable = !dataset || dataset.status === 'NOT_AVAILABLE' || (files.length > 0 && files.every((f) => f.status === 'NOT_FOUND'));

  return (
    <PageContainer>
      {/* Page Header */}
      <PageHeader
        title="Dataset Management & Research"
        subtitle="Ingestion, validation, schema profiling, and ML preparation for CIC-IDS2017 benchmark telemetry"
        statusBadge={getStatusBadge(dataset?.status)}
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={handleRefresh}
              disabled={actionLoading !== null}
              className="btn btn-secondary btn-sm font-semibold flex items-center gap-1.5 cursor-pointer"
            >
              <RefreshCw size={14} className={actionLoading === 'refresh' ? 'animate-spin' : ''} />
              Sync Inventory
            </button>
            <button
              onClick={handleValidate}
              disabled={actionLoading !== null}
              className="btn btn-secondary btn-sm font-semibold flex items-center gap-1.5 cursor-pointer"
            >
              <CheckCircle2 size={14} />
              Validate Dataset
            </button>
            <button
              onClick={handleProcess}
              disabled={actionLoading !== null || isNotAvailable}
              className="btn btn-primary btn-sm font-bold flex items-center gap-1.5 cursor-pointer"
            >
              <Play size={14} />
              Process Pipeline
            </button>
          </div>
        }
      />

      {/* Message Banner */}
      {message && (
        <div className={`p-4 rounded-xl text-xs font-semibold flex items-center justify-between shadow-xs border ${
          message.type === 'error' ? 'bg-rose-50 border-rose-200 text-rose-900' :
          message.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-900' :
          'bg-blue-50 border-blue-200 text-blue-900'
        }`}>
          <div className="flex items-center gap-2">
            {message.type === 'error' && <ShieldAlert size={16} className="text-rose-600" />}
            {message.type === 'success' && <CheckCircle2 size={16} className="text-emerald-600" />}
            {message.type === 'info' && <Info size={16} className="text-blue-600" />}
            <span>{message.text}</span>
          </div>
          <button onClick={() => setMessage(null)} className="text-slate-400 hover:text-slate-600 font-bold ml-4 cursor-pointer">✕</button>
        </div>
      )}

      {/* Overview Card */}
      <Card p-6 className="border-l-4 border-l-[#F5B700] shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center flex-shrink-0">
              <Database size={24} className="text-[#B45309]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="card-title text-lg font-extrabold text-slate-900">
                  {dataset?.name || 'CIC-IDS2017 Benchmark Dataset'}
                </h2>
                <span className="text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-mono font-bold">
                  v{dataset?.version || '1.0.0'}
                </span>
              </div>
              <span className="text-xs text-slate-500 font-medium">
                {dataset?.source || 'Canadian Institute for Cybersecurity (University of New Brunswick)'}
              </span>
            </div>
          </div>
          <a
            href="https://www.unb.ca/cic/datasets/ids-2017.html"
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-secondary btn-sm text-xs self-start md:self-auto flex items-center gap-1.5"
          >
            <ExternalLink size={14} /> Official Dataset Portal
          </a>
        </div>
        <p className="text-xs text-slate-600 leading-relaxed mb-5 font-medium">
          {dataset?.description || 'Gold standard intrusion detection dataset containing 8 flow capture scenarios: Benign baseline traffic and 7 attack categories (DDoS, DoS, PortScan, Botnet, Brute Force, Web Attacks, and Infiltration).'}
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 border-t border-slate-100 text-xs">
          <div>
            <span className="text-[10.5px] font-extrabold text-slate-400 uppercase tracking-wider block">Dataset Status</span>
            <p className="font-bold text-slate-900 mt-0.5">{dataset?.status || 'NOT_AVAILABLE'}</p>
          </div>
          <div>
            <span className="text-[10.5px] font-extrabold text-slate-400 uppercase tracking-wider block">Tracked Scenarios</span>
            <p className="font-semibold text-slate-900 mt-0.5">{files.length || 8} Parquet Files</p>
          </div>
          <div>
            <span className="text-[10.5px] font-extrabold text-slate-400 uppercase tracking-wider block">Total Validated Records</span>
            <p className="font-semibold text-emerald-700 mt-0.5">{dataset?.total_records ? dataset.total_records.toLocaleString() : '0 rows'}</p>
          </div>
          <div>
            <span className="text-[10.5px] font-extrabold text-slate-400 uppercase tracking-wider block">Detected Features</span>
            <p className="font-bold text-slate-900 mt-0.5">{dataset?.feature_count || schema?.feature_count || 0} Columns</p>
          </div>
        </div>
      </Card>

      {/* Truthful Availability Banner (When files missing) */}
      {isNotAvailable && (
        <Card p-6 className="bg-amber-50/70 border border-amber-300 shadow-xs">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 border border-amber-300 flex items-center justify-center flex-shrink-0 mt-0.5">
              <AlertTriangle size={20} className="text-amber-800" />
            </div>
            <div className="space-y-2 flex-1">
              <h3 className="text-sm font-extrabold text-amber-950 flex items-center gap-2">
                Dataset Files Not Available on Local Disk
              </h3>
              <p className="text-xs text-amber-900 leading-relaxed font-medium">
                SentinelAI strictly adheres to research data integrity: <strong className="font-bold">No synthetic, random, or fake placeholder records are generated.</strong> All metrics, schema definitions, and label counts truthfully reflect the files present in your workspace.
              </p>
              <div className="bg-white/80 p-3.5 rounded-lg border border-amber-200 text-xs text-slate-800 font-mono space-y-1.5">
                <span className="text-slate-500 font-sans font-extrabold text-[11px] uppercase tracking-wider block">Target Ingestion Path:</span>
                <div className="bg-slate-900 text-emerald-400 p-2 rounded text-xs overflow-x-auto select-all font-mono">
                  {dataset?.target_raw_path || 'data/raw/cic-ids2017/'}
                </div>
                <span className="text-slate-500 font-sans text-[11px] block mt-1">
                  Place any or all of the 8 official CIC-IDS2017 Parquet files into the directory above, then click <strong className="font-bold font-sans">"Sync Inventory"</strong> or <strong className="font-bold font-sans">"Validate Dataset"</strong> to automatically discover and profile them.
                </span>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab('inventory')}
          className={`px-4 py-2 text-xs font-bold rounded-lg transition-colors flex items-center gap-2 cursor-pointer ${
            activeTab === 'inventory' ? 'bg-slate-900 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <HardDrive size={14} /> Parquet Inventory ({files.length})
        </button>
        <button
          onClick={() => setActiveTab('quality')}
          className={`px-4 py-2 text-xs font-bold rounded-lg transition-colors flex items-center gap-2 cursor-pointer ${
            activeTab === 'quality' ? 'bg-slate-900 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <ShieldAlert size={14} /> Data Quality Report
        </button>
        <button
          onClick={() => setActiveTab('labels')}
          className={`px-4 py-2 text-xs font-bold rounded-lg transition-colors flex items-center gap-2 cursor-pointer ${
            activeTab === 'labels' ? 'bg-slate-900 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <BarChart3 size={14} /> Label Taxonomy & Distribution
        </button>
        <button
          onClick={() => setActiveTab('schema')}
          className={`px-4 py-2 text-xs font-bold rounded-lg transition-colors flex items-center gap-2 cursor-pointer ${
            activeTab === 'schema' ? 'bg-slate-900 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <FileText size={14} /> Schema & Features ({schema?.feature_count || 0})
        </button>
      </div>

      {/* Tab Content 1: Parquet File Inventory */}
      {activeTab === 'inventory' && (
        <Card p-6>
          <div className="mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="card-title text-base font-bold text-slate-900">CIC-IDS2017 Parquet Scenario Files</h3>
              <p className="text-xs text-slate-500">Validation receipts, file sizes, row counts, and detected attack taxonomies</p>
            </div>
            <span className="text-xs text-slate-500 font-mono">
              Directory: <code className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-800">data/raw/cic-ids2017/</code>
            </span>
          </div>

          <DataTable>
            <thead>
              <tr>
                <th>File Name</th>
                <th>Scenario Description</th>
                <th>Validation Status</th>
                <th>Size</th>
                <th>Row Count</th>
                <th>Columns</th>
                <th>Attack Taxonomies</th>
                <th className="text-right">Inspection</th>
              </tr>
            </thead>
            <tbody>
              {files.map((file) => (
                <tr key={file.filename} className="hover:bg-slate-50/80 transition-colors">
                  <td className="font-mono text-xs font-bold text-slate-900">
                    <div className="flex items-center gap-2">
                      <FileText size={15} className="text-slate-400 flex-shrink-0" />
                      <span>{file.filename}</span>
                    </div>
                  </td>
                  <td className="text-xs text-slate-700 font-medium">{file.scenario}</td>
                  <td>{getFileStatusBadge(file.status)}</td>
                  <td className="text-xs font-mono text-slate-600">
                    {file.size_mb > 0 ? `${file.size_mb.toFixed(2)} MB` : '0 MB'}
                  </td>
                  <td className="text-xs font-mono font-bold text-slate-900">
                    {file.rows > 0 ? file.rows.toLocaleString() : '—'}
                  </td>
                  <td className="text-xs font-mono text-slate-700">
                    {file.columns > 0 ? file.columns : '—'}
                  </td>
                  <td>
                    <div className="flex flex-wrap gap-1">
                      {file.attack_types.map((attack) => (
                        <span
                          key={attack}
                          className={`px-2 py-0.5 text-[10.5px] font-bold rounded ${
                            attack === 'BENIGN' ? 'bg-slate-100 text-slate-700' : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {attack}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="text-right">
                    <button
                      onClick={() => setSelectedFileModal(file)}
                      className="btn btn-secondary btn-sm text-xs font-semibold px-2.5 py-1 cursor-pointer"
                    >
                      Details
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        </Card>
      )}

      {/* Tab Content 2: Data Quality Report */}
      {activeTab === 'quality' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card p-5 className="border-l-4 border-l-blue-500">
              <span className="text-[10.5px] font-extrabold text-slate-400 uppercase tracking-wider block">Missing Values</span>
              <p className="text-2xl font-black text-slate-900 mt-1">
                {quality?.missing_values_count ? quality.missing_values_count.toLocaleString() : 0}
              </p>
              <span className="text-xs text-slate-500 font-medium mt-0.5 block">
                {quality?.missing_pct ? `${quality.missing_pct.toFixed(3)}% of matrix` : '0.00% missing'}
              </span>
            </Card>

            <Card p-5 className="border-l-4 border-l-amber-500">
              <span className="text-[10.5px] font-extrabold text-slate-400 uppercase tracking-wider block">Estimated Duplicate Rows</span>
              <p className="text-2xl font-black text-slate-900 mt-1">
                {quality?.duplicate_rows_est ? quality.duplicate_rows_est.toLocaleString() : 0}
              </p>
              <span className="text-xs text-slate-500 font-medium mt-0.5 block">
                {quality?.duplicate_pct ? `${quality.duplicate_pct.toFixed(2)}% estimated` : '0.00% duplicates'}
              </span>
            </Card>

            <Card p-5 className="border-l-4 border-l-rose-500">
              <span className="text-[10.5px] font-extrabold text-slate-400 uppercase tracking-wider block">Infinite / NaN Values</span>
              <p className="text-2xl font-black text-slate-900 mt-1">
                {quality?.infinite_values_count ? quality.infinite_values_count.toLocaleString() : 0}
              </p>
              <span className="text-xs text-slate-500 font-medium mt-0.5 block">
                Imputed in preprocessing pipeline
              </span>
            </Card>

            <Card p-5 className="border-l-4 border-l-purple-500">
              <span className="text-[10.5px] font-extrabold text-slate-400 uppercase tracking-wider block">Constant Zero/Near-Zero Columns</span>
              <p className="text-2xl font-black text-slate-900 mt-1">
                {quality?.constant_features_count ?? quality?.constant_features?.length ?? 0}
              </p>
              <span className="text-xs text-slate-500 font-medium mt-0.5 block">
                Identified for variance filtering
              </span>
            </Card>
          </div>

          <Card p-6>
            <h3 className="card-title text-base font-bold text-slate-900 mb-2">Quality & Preprocessing Directives</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              When raw Parquet files are ingested, the preprocessing pipeline applies:
            </p>
            <ul className="mt-3 space-y-2 text-xs text-slate-700 font-medium">
              <li className="flex items-center gap-2">
                <CheckCircle2 size={15} className="text-emerald-600" />
                <span><strong className="font-bold text-slate-900">Infinite Values Treatment</strong>: Replaces <code className="bg-slate-100 px-1 py-0.5 rounded font-mono">Inf</code> and <code className="bg-slate-100 px-1 py-0.5 rounded font-mono">-Inf</code> in rates (e.g., Flow Bytes/s) with feature max statistics.</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 size={15} className="text-emerald-600" />
                <span><strong className="font-bold text-slate-900">Missing Value Imputation</strong>: Imputes missing flow duration or packet timing values with median feature values.</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 size={15} className="text-emerald-600" />
                <span><strong className="font-bold text-slate-900">Label Normalization</strong>: Standardizes raw labels (e.g. <code className="bg-slate-100 px-1 py-0.5 rounded font-mono">DoS Slowloris</code>, <code className="bg-slate-100 px-1 py-0.5 rounded font-mono">DoS Hulk</code>) into unified binary (<code className="bg-slate-100 px-1 py-0.5 rounded font-mono">BENIGN</code> vs <code className="bg-slate-100 px-1 py-0.5 rounded font-mono">ATTACK</code>) and 8 multiclass taxonomies.</span>
              </li>
            </ul>
          </Card>
        </div>
      )}

      {/* Tab Content 3: Label Taxonomy & Distribution */}
      {activeTab === 'labels' && (
        <Card p-6>
          <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="card-title text-base font-bold text-slate-900">Verified Class Label Distribution</h3>
              <p className="text-xs text-slate-500">Actual record counts extracted directly from Parquet label columns</p>
            </div>
            {labels && (
              <span className="text-xs font-bold text-slate-700 bg-slate-100 px-3 py-1 rounded-full">
                {labels.total_records.toLocaleString()} Total Labeled Rows
              </span>
            )}
          </div>

          {labels && labels.items && labels.items.length > 0 ? (
            <div className="space-y-6">
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={labels.items} margin={{ top: 10, right: 30, left: 20, bottom: 40 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 11, fill: '#64748B', fontWeight: 600 }}
                      interval={0}
                      angle={-20}
                      textAnchor="end"
                    />
                    <YAxis tick={{ fontSize: 11, fill: '#64748B' }} />
                    <Tooltip
                      formatter={(val: unknown) => [typeof val === 'number' ? val.toLocaleString() : String(val), 'Records']}
                      contentStyle={{ backgroundColor: '#0F172A', color: '#F8FAFC', borderRadius: '8px', fontSize: '12px' }}
                    />
                    <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                      {labels.items.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={BAR_COLORS[index % BAR_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-4 border-t border-slate-100">
                {labels.items.map((item, idx) => (
                  <div key={item.name} className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs">
                    <div className="flex items-center gap-2">
                      <span
                        className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: BAR_COLORS[idx % BAR_COLORS.length] }}
                      />
                      <span className="font-bold text-slate-900 truncate">{item.name}</span>
                    </div>
                    <div className="mt-2 flex justify-between text-slate-600 font-mono">
                      <span>{item.count.toLocaleString()}</span>
                      <span className="font-bold text-slate-900">{item.percentage.toFixed(2)}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="p-12 text-center text-slate-400 font-medium text-xs bg-slate-50 rounded-xl border border-dashed border-slate-200">
              <BarChart3 size={32} className="mx-auto text-slate-300 mb-2" />
              <p className="font-bold text-slate-600">No Parquet label data available yet</p>
              <p className="mt-1">Place Parquet files in <code className="bg-slate-200 px-1 rounded text-slate-800">data/raw/cic-ids2017/</code> to visualize real label distributions.</p>
            </div>
          )}
        </Card>
      )}

      {/* Tab Content 4: Schema & Features */}
      {activeTab === 'schema' && (
        <Card p-6>
          <div className="mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="card-title text-base font-bold text-slate-900">Detected Schema & Feature Statistics</h3>
              <p className="text-xs text-slate-500">Flow features, data types, and computed descriptive statistics</p>
            </div>

            <div className="relative w-full sm:w-64">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search feature columns..."
                value={searchFeature}
                onChange={(e) => setSearchFeature(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>
          </div>

          <DataTable>
            <thead>
              <tr>
                <th>Feature Column Name</th>
                <th>Data Type</th>
                <th>Category</th>
                <th>Min</th>
                <th>Mean</th>
                <th>Std Dev</th>
                <th>Max</th>
              </tr>
            </thead>
            <tbody>
              {filteredFeatures.map((feat) => (
                <tr key={feat.name} className="hover:bg-slate-50 transition-colors">
                  <td className="font-mono text-xs font-bold text-slate-900">
                    <div className="flex items-center gap-1.5">
                      {feat.is_label && <Badge variant="medium" className="px-1.5 py-0 text-[9px] uppercase font-bold">LABEL</Badge>}
                      <span>{feat.name}</span>
                    </div>
                  </td>
                  <td className="font-mono text-xs text-slate-600">{feat.data_type}</td>
                  <td>
                    <span className={`px-2 py-0.5 text-[10.5px] font-bold rounded ${
                      feat.is_numeric ? 'bg-blue-50 text-blue-700' : 'bg-purple-50 text-purple-700'
                    }`}>
                      {feat.is_numeric ? 'Numeric' : 'Categorical'}
                    </span>
                  </td>
                  <td className="font-mono text-xs text-slate-700">{feat.min !== undefined ? feat.min.toFixed(2) : '—'}</td>
                  <td className="font-mono text-xs text-slate-700">{feat.mean !== undefined ? feat.mean.toFixed(2) : '—'}</td>
                  <td className="font-mono text-xs text-slate-700">{feat.std !== undefined ? feat.std.toFixed(2) : '—'}</td>
                  <td className="font-mono text-xs text-slate-700">{feat.max !== undefined ? feat.max.toFixed(2) : '—'}</td>
                </tr>
              ))}
              {filteredFeatures.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-xs text-slate-400 font-medium">
                    {schema?.features?.length ? 'No matching feature columns found' : 'Schema details will populate when Parquet files are placed in data/raw/cic-ids2017/'}
                  </td>
                </tr>
              )}
            </tbody>
          </DataTable>
        </Card>
      )}

      {/* File Inspection Modal */}
      {selectedFileModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-200">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <FileText size={18} className="text-slate-700" />
                <h3 className="font-extrabold text-slate-900 text-sm">{selectedFileModal.filename}</h3>
              </div>
              <button onClick={() => setSelectedFileModal(null)} className="text-slate-400 hover:text-slate-600 font-bold cursor-pointer">✕</button>
            </div>

            <div className="py-4 space-y-3 text-xs">
              <div>
                <span className="text-slate-400 font-bold block uppercase text-[10px]">Scenario</span>
                <p className="font-semibold text-slate-900">{selectedFileModal.scenario}</p>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100">
                <div>
                  <span className="text-slate-400 font-bold block uppercase text-[10px]">File Status</span>
                  <div className="mt-1">{getFileStatusBadge(selectedFileModal.status)}</div>
                </div>
                <div>
                  <span className="text-slate-400 font-bold block uppercase text-[10px]">File Size</span>
                  <p className="font-mono font-bold text-slate-900 mt-1">{selectedFileModal.size_mb.toFixed(2)} MB</p>
                </div>
                <div>
                  <span className="text-slate-400 font-bold block uppercase text-[10px]">Validated Rows</span>
                  <p className="font-mono font-bold text-slate-900 mt-1">{selectedFileModal.rows.toLocaleString()}</p>
                </div>
                <div>
                  <span className="text-slate-400 font-bold block uppercase text-[10px]">Column Count</span>
                  <p className="font-mono font-bold text-slate-900 mt-1">{selectedFileModal.columns}</p>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100">
                <span className="text-slate-400 font-bold block uppercase text-[10px] mb-1">Detected Attack Taxonomies</span>
                <div className="flex flex-wrap gap-1">
                  {selectedFileModal.attack_types.map((a) => (
                    <span key={a} className="px-2 py-0.5 bg-slate-100 text-slate-800 rounded font-bold">{a}</span>
                  ))}
                </div>
              </div>

              {selectedFileModal.error_message && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 font-mono text-[11px]">
                  <strong>Error:</strong> {selectedFileModal.error_message}
                </div>
              )}
            </div>

            <div className="pt-4 border-t border-slate-100 flex justify-end">
              <button onClick={() => setSelectedFileModal(null)} className="btn btn-secondary btn-sm font-bold cursor-pointer">
                Close Inspection
              </button>
            </div>
          </div>
        </div>
      )}
    </PageContainer>
  );
}
