import { useState, useEffect } from 'react';
import { ExternalLink, Search, Target, Shield } from 'lucide-react';
import clsx from 'clsx';
import { api } from '../services/api';
import type { MitreTechnique } from '../types';
import { PageContainer, PageHeader } from '../components/common/PageContainer';
import { Card } from '../components/common/Card';
import { EmptyState } from '../components/common/EmptyState';
import { Badge } from '../components/common/Badge';

export default function MitreAttackPage() {
  const [techniques, setTechniques] = useState<MitreTechnique[]>([]);
  const [selectedTechnique, setSelectedTechnique] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    api.getMitreTechniques().then(res => {
      setTechniques(res.techniques);
      if (res.techniques.length > 0) {
        setSelectedTechnique(res.techniques[0].id);
      }
    }).catch(console.error);
  }, []);

  const selected = techniques.find(t => t.id === selectedTechnique) || techniques[0];

  const filtered = techniques.filter(t =>
    t.name.toLowerCase().includes(search.toLowerCase()) ||
    t.id.toLowerCase().includes(search.toLowerCase()) ||
    t.tactic.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <PageContainer>
      {/* Page Header */}
      <PageHeader
        title="MITRE ATT&CK Framework Mapping"
        subtitle="Standardized threat taxonomy — Tactics, techniques, and threat mapping"
        statusBadge={
          <Badge variant="neutral" className="px-3 py-1 text-xs font-bold uppercase tracking-wider">
            ATT&CK Matrix
          </Badge>
        }
      />

      {/* Main Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Technique List */}
        <Card p-6 className="flex flex-col justify-between">
          <div>
            <div className="mb-4 space-y-2">
              <h3 className="card-title text-base">Mapped Techniques</h3>
              <div className="relative">
                <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none z-10" />
                <input
                  type="text"
                  placeholder="Filter technique or tactic..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="input input-has-icon py-2 text-xs bg-slate-50 focus:bg-white rounded-xl"
                />
              </div>
            </div>

            <div className="space-y-2 max-h-[520px] overflow-y-auto pr-1">
              {filtered.map((tech) => (
                <button
                  key={tech.id}
                  onClick={() => setSelectedTechnique(tech.id)}
                  className={clsx(
                    'w-full text-left p-3.5 rounded-xl border transition-all cursor-pointer space-y-1.5',
                    selectedTechnique === tech.id
                      ? 'border-[#F5B700] bg-amber-500/10 text-slate-900 font-extrabold ring-2 ring-amber-400/20 shadow-2xs'
                      : 'border-slate-200/80 hover:bg-slate-50 text-slate-600'
                  )}
                >
                  <div className="flex items-center justify-between text-xs gap-2">
                    <span className="font-mono text-blue-600 font-bold">{tech.id}</span>
                    <Badge variant="info" className="text-[10.5px] font-bold">{tech.tactic}</Badge>
                  </div>
                  <div className="text-xs font-extrabold text-slate-900 truncate leading-snug">{tech.name}</div>
                </button>
              ))}
            </div>
          </div>
        </Card>

        {/* Right Column: Technique Details Workspace */}
        <Card p-6 className="lg:col-span-2 flex flex-col justify-between">
          {selected ? (
            <div>
              <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-6">
                <div>
                  <span className="text-xs font-mono font-bold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-md border border-blue-200">
                    {selected.id}
                  </span>
                  <h2 className="text-xl font-extrabold text-slate-900 mt-2.5">{selected.name}</h2>
                </div>
                <Badge variant="high" className="text-xs px-3.5 py-1.5 font-bold">
                  Tactic: {selected.tactic}
                </Badge>
              </div>

              <div className="space-y-6">
                <div>
                  <h4 className="text-xs font-extrabold text-slate-400 uppercase tracking-wider mb-2">Description</h4>
                  <div className="text-sm text-slate-700 leading-relaxed bg-slate-50 p-4 sm:p-5 rounded-xl border border-slate-200/90 font-medium">
                    {selected.description}
                  </div>
                </div>

                <div>
                  <h4 className="text-xs font-extrabold text-slate-400 uppercase tracking-wider mb-2.5">Mapped Attack Categories</h4>
                  <div className="flex flex-wrap gap-2">
                    {selected.attack_types.map((type) => (
                      <Badge key={type} variant="critical" className="text-xs py-1 px-3.5 font-bold">
                        {type}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <EmptyState
              icon={Target}
              title="No MITRE Mappings Available"
              description="Select a technique from the list on the left to inspect tactics and technique specifications."
              variant="normal"
              minHeight="min-h-[300px]"
            />
          )}

          {selected?.url && (
            <div className="mt-8 pt-4 border-t border-slate-100 flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
                <Shield size={16} className="text-slate-400" />
                <span>Official MITRE Enterprise Matrix Taxonomy</span>
              </div>
              <a
                href={selected.url}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-primary btn-sm text-xs font-bold"
              >
                <ExternalLink size={14} /> Open MITRE Specification
              </a>
            </div>
          )}
        </Card>
      </div>
    </PageContainer>
  );
}
