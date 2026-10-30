import { useState, useEffect } from 'react';
import {
  Save, Check, Sliders, Shield, Users, UserPlus,
  UserCheck, UserX, KeyRound, RefreshCw, AlertCircle, X, Loader2
} from 'lucide-react';
import clsx from 'clsx';
import { api } from '../services/api';
import type { AppSettings } from '../types';
import type { User, AuditLogEntry, UserRole } from '../types/auth';
import { useAuth } from '../context/AuthContext';
import { PageContainer, PageHeader } from '../components/common/PageContainer';
import { Card } from '../components/common/Card';
import { Badge } from '../components/common/Badge';

export default function SettingsPage() {
  const { user: currentUser } = useAuth();
  const isAdmin = currentUser?.role === 'ADMIN';

  const [activeTab, setActiveTab] = useState<'preferences' | 'users'>('preferences');

  // Platform Preferences State
  const [settings, setSettings] = useState<AppSettings>({
    detection_mode: 'binary',
    alert_threshold: 50.0,
    replay_speed: 1.0,
    notifications_enabled: true,
    selected_model: 'Random Forest Baseline',
    selected_dataset: 'CIC-IDS2017 Benchmark',
  });
  const [saved, setSaved] = useState(false);

  // User Management State (Admin only)
  const [users, setUsers] = useState<User[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [inviteRole, setInviteRole] = useState<UserRole>('SECURITY_ANALYST');
  const [invitePassword, setInvitePassword] = useState('');
  const [inviteLoading, setInviteLoading] = useState(false);
  const [userActionMessage, setUserActionMessage] = useState<string | null>(null);
  const [userActionError, setUserActionError] = useState<string | null>(null);

  useEffect(() => {
    api.getSettings().then(setSettings).catch(console.error);
  }, []);

  const loadUserData = async () => {
    if (!isAdmin) return;
    setLoadingUsers(true);
    try {
      const [uList, logs] = await Promise.all([
        api.auth.getUsers(),
        api.auth.getAuditLogs(15),
      ]);
      setUsers(uList);
      setAuditLogs(logs);
    } catch (err: any) {
      console.error('Failed to load user management data:', err);
    } finally {
      setLoadingUsers(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'users' && isAdmin) {
      loadUserData();
    }
  }, [activeTab, isAdmin]);

  const handleSavePreferences = async () => {
    await api.updateSettings(settings).catch(console.error);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const handleInviteUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviteLoading(true);
    setUserActionError(null);
    try {
      await api.auth.inviteUser({
        email: inviteEmail,
        display_name: inviteName,
        role: inviteRole,
        initial_password: invitePassword || undefined,
      });
      setInviteModalOpen(false);
      setInviteEmail('');
      setInviteName('');
      setInvitePassword('');
      setUserActionMessage(`User ${inviteEmail} provisioned successfully.`);
      setTimeout(() => setUserActionMessage(null), 3500);
      await loadUserData();
    } catch (err: any) {
      setUserActionError(err.message || 'Failed to provision user.');
    } finally {
      setInviteLoading(false);
    }
  };

  const handleToggleStatus = async (targetUser: User) => {
    try {
      await api.auth.updateUserStatus(targetUser.id, !targetUser.is_active);
      setUserActionMessage(`Updated account status for ${targetUser.email}.`);
      setTimeout(() => setUserActionMessage(null), 3000);
      await loadUserData();
    } catch (err: any) {
      setUserActionError(err.message || 'Failed to update account status.');
      setTimeout(() => setUserActionError(null), 3000);
    }
  };

  const handleChangeRole = async (userId: string, newRole: UserRole) => {
    try {
      await api.auth.updateUserRole(userId, newRole);
      setUserActionMessage('Role updated successfully.');
      setTimeout(() => setUserActionMessage(null), 3000);
      await loadUserData();
    } catch (err: any) {
      setUserActionError(err.message || 'Failed to update role.');
      setTimeout(() => setUserActionError(null), 3000);
    }
  };

  const handleRevokeSessions = async (userId: string) => {
    try {
      await api.auth.revokeUserSessions(userId);
      setUserActionMessage('Active sessions revoked for this user.');
      setTimeout(() => setUserActionMessage(null), 3000);
      await loadUserData();
    } catch (err: any) {
      setUserActionError(err.message || 'Failed to revoke sessions.');
      setTimeout(() => setUserActionError(null), 3000);
    }
  };

  return (
    <PageContainer className="max-w-5xl">
      {/* Page Header */}
      <PageHeader
        title="Settings & Administration"
        subtitle="Platform preferences, detection engine thresholds, and enterprise access control"
        statusBadge={
          <Badge variant="neutral" className="px-3 py-1 text-xs font-bold uppercase tracking-wider">
            {activeTab === 'preferences' ? 'System Preferences' : 'Enterprise Administration'}
          </Badge>
        }
      />

      {/* Navigation Tabs */}
      <div className="flex border-b border-slate-200 gap-6">
        <button
          onClick={() => setActiveTab('preferences')}
          className={clsx(
            'pb-3 text-xs font-extrabold cursor-pointer border-b-2 transition-all flex items-center gap-2',
            activeTab === 'preferences'
              ? 'border-[#F5B700] text-slate-900'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          )}
        >
          <Sliders size={16} />
          <span>Platform Preferences</span>
        </button>

        {isAdmin && (
          <button
            onClick={() => setActiveTab('users')}
            className={clsx(
              'pb-3 text-xs font-extrabold cursor-pointer border-b-2 transition-all flex items-center gap-2',
              activeTab === 'users'
                ? 'border-[#F5B700] text-slate-900'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            )}
          >
            <Users size={16} />
            <span>User Management &amp; RBAC</span>
            <span className="text-[10px] px-1.5 py-0.2 bg-amber-100 text-amber-800 rounded font-bold">
              ADMIN
            </span>
          </button>
        )}
      </div>

      {/* ─── TAB 1: Platform Preferences ─────────────────────────────────── */}
      {activeTab === 'preferences' && (
        <div className="space-y-6">
          {saved && (
            <div className="p-4 rounded-xl bg-emerald-50 text-emerald-800 text-sm font-bold flex items-center gap-2 border border-emerald-200 animate-fade-in shadow-2xs">
              <Check size={18} className="text-emerald-600" /> Platform settings saved successfully.
            </div>
          )}

          {/* Detection Mode Card */}
          <Card className="space-y-5 p-6">
            <div className="flex items-center gap-2">
              <Sliders size={18} className="text-slate-600" />
              <h3 className="card-title text-base">Detection Classification Engine</h3>
            </div>

            <div className="space-y-5">
              <div className="min-w-0">
                <label className="text-xs font-extrabold text-slate-400 uppercase tracking-wider mb-3 block truncate">
                  Classification Architecture
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 min-w-0">
                  {[
                    { id: 'binary', title: 'Binary Detection Mode', desc: 'Classifies traffic strictly into BENIGN vs ATTACK' },
                    { id: 'multiclass', title: 'Multiclass Detection Mode', desc: 'Classifies traffic into explicit attack types (DDoS, DoS, PortScan, etc.)' },
                  ].map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setSettings(s => ({ ...s, detection_mode: m.id as 'binary' | 'multiclass' }))}
                      className={clsx(
                        'p-4 sm:p-5 rounded-xl text-left border transition-all cursor-pointer flex flex-col justify-between min-w-0 overflow-hidden',
                        settings.detection_mode === m.id
                          ? 'bg-amber-500/10 border-amber-400 ring-2 ring-amber-400/20 font-bold'
                          : 'border-slate-200 hover:bg-slate-50'
                      )}
                    >
                      <div className="min-w-0">
                        <div className="font-extrabold text-sm text-slate-900 mb-1 break-words whitespace-normal">{m.title}</div>
                        <div className="text-xs text-slate-500 font-medium leading-relaxed break-words whitespace-normal">{m.desc}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 min-w-0">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-3 gap-2 min-w-0">
                  <label className="text-xs font-extrabold text-slate-400 uppercase tracking-wider block shrink-0">
                    Alert Generation Threshold
                  </label>
                  <span className="text-xs font-extrabold text-red-700 bg-red-50 px-3 py-1 rounded-lg border border-red-200 shrink-0">
                    Risk Score &ge; {settings.alert_threshold}
                  </span>
                </div>
                <input
                  type="range"
                  min={10}
                  max={90}
                  value={settings.alert_threshold}
                  onChange={(e) => setSettings(s => ({ ...s, alert_threshold: Number(e.target.value) }))}
                  className="w-full accent-[#F5B700] cursor-pointer my-2 max-w-full"
                />
                <div className="flex justify-between text-[11px] font-semibold text-slate-400 min-w-0">
                  <span className="truncate pr-2">Low (Higher sensitivity)</span>
                  <span className="truncate pl-2 text-right">High (Critical focus)</span>
                </div>
              </div>
            </div>
          </Card>

          {/* Model & Dataset Selection Card */}
          <Card className="space-y-5 p-6">
            <div className="flex items-center gap-2">
              <Shield size={18} className="text-slate-600" />
              <h3 className="card-title text-base">Active Model &amp; Dataset Bindings</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 min-w-0">
              <div className="min-w-0">
                <label className="text-xs font-extrabold text-slate-400 uppercase tracking-wider mb-2.5 block truncate">
                  Active Detection Model
                </label>
                <select
                  value={settings.selected_model}
                  onChange={(e) => setSettings(s => ({ ...s, selected_model: e.target.value }))}
                  className="input select text-xs py-2.5 bg-slate-50 focus:bg-white w-full max-w-full truncate"
                >
                  <option value="Random Forest Baseline">Random Forest Baseline</option>
                  <option value="XGBoost Classifier">XGBoost Classifier</option>
                  <option value="Logistic Regression">Logistic Regression Baseline</option>
                  <option value="Isolation Forest">Isolation Forest Anomaly Detector</option>
                  <option value="Autoencoder">Deep Autoencoder Network</option>
                  <option value="LSTM Sequence Classifier">LSTM Sequence Classifier</option>
                </select>
              </div>

              <div className="min-w-0">
                <label className="text-xs font-extrabold text-slate-400 uppercase tracking-wider mb-2.5 block truncate">
                  Active Data Stream Source
                </label>
                <select
                  value={settings.selected_dataset}
                  onChange={(e) => setSettings(s => ({ ...s, selected_dataset: e.target.value }))}
                  className="input select text-xs py-2.5 bg-slate-50 focus:bg-white w-full max-w-full truncate"
                >
                  <option value="CIC-IDS2017 Benchmark">Historical CIC-IDS2017 Benchmark (Dataset Replay)</option>
                </select>
                <span className="text-[11px] text-slate-500 font-medium block mt-1.5">
                  Truthfully streaming historical benchmark flow telemetry from <code className="bg-slate-100 px-1 py-0.5 rounded font-mono">data/raw/cic-ids2017/</code>.
                </span>
              </div>
            </div>
          </Card>

          {/* Form Action Card Footer */}
          <Card padding="compact" className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4">
            <div className="text-xs text-slate-500 font-medium">
              Persist detection engine rules and baseline classifier preferences across platform sessions.
            </div>
            <button
              className="btn btn-primary px-6 py-2.5 font-bold text-xs flex-shrink-0 w-full sm:w-auto cursor-pointer"
              onClick={handleSavePreferences}
            >
              <Save size={16} /> Save Configuration Settings
            </button>
          </Card>
        </div>
      )}

      {/* ─── TAB 2: User Management & RBAC (Admin only) ──────────────────── */}
      {activeTab === 'users' && isAdmin && (
        <div className="space-y-6">
          {/* Notification Messages */}
          {userActionMessage && (
            <div className="p-4 rounded-xl bg-emerald-50 text-emerald-800 text-xs font-bold flex items-center gap-2 border border-emerald-200 animate-fade-in shadow-2xs">
              <Check size={16} className="text-emerald-600" /> {userActionMessage}
            </div>
          )}
          {userActionError && (
            <div className="p-4 rounded-xl bg-red-50 text-red-800 text-xs font-bold flex items-center gap-2 border border-red-200 animate-fade-in shadow-2xs">
              <AlertCircle size={16} className="text-red-600" /> {userActionError}
            </div>
          )}

          {/* Users Header Card */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-extrabold text-slate-900">
                Enterprise Accounts &amp; Access Controls
              </h3>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Manage provisioned security operators, modify RBAC roles, and inspect active sessions.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={loadUserData}
                className="btn btn-secondary text-xs px-3 py-2 font-bold cursor-pointer"
                title="Refresh user list"
              >
                <RefreshCw size={14} className={loadingUsers ? 'animate-spin' : ''} />
              </button>
              <button
                onClick={() => setInviteModalOpen(true)}
                className="btn btn-primary text-xs px-4 py-2 font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <UserPlus size={15} />
                <span>Invite User</span>
              </button>
            </div>
          </div>

          {/* Users Table */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200/80 text-[10.5px] font-extrabold text-slate-400 uppercase tracking-wider">
                    <th className="py-3 px-4">User</th>
                    <th className="py-3 px-4">Role</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Auth Providers</th>
                    <th className="py-3 px-4">Last Login</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {users.map((u) => {
                    const isSelf = u.id === currentUser?.id;
                    return (
                      <tr key={u.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-3.5 px-4">
                          <div className="font-extrabold text-slate-900">{u.display_name}</div>
                          <div className="font-mono text-[11px] text-slate-500 mt-0.5">{u.email}</div>
                        </td>
                        <td className="py-3.5 px-4">
                          <select
                            value={u.role}
                            disabled={isSelf}
                            onChange={(e) => handleChangeRole(u.id, e.target.value as UserRole)}
                            className="text-xs font-bold py-1 px-2 rounded-lg bg-slate-50 border border-slate-200 focus:bg-white focus:border-amber-400 outline-none"
                          >
                            <option value="ADMIN">ADMIN</option>
                            <option value="SECURITY_ANALYST">SECURITY_ANALYST</option>
                            <option value="VIEWER">VIEWER</option>
                          </select>
                        </td>
                        <td className="py-3.5 px-4">
                          {u.is_active ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10.5px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Active
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10.5px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                              <span className="w-1.5 h-1.5 rounded-full bg-slate-400" /> Disabled
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="flex gap-1 flex-wrap">
                            {u.auth_providers?.map((p) => (
                              <span key={p} className="text-[10px] font-mono px-1.5 py-0.5 bg-slate-100 rounded text-slate-600">
                                {p}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-slate-500 text-[11px] font-mono">
                          {u.last_login_at ? new Date(u.last_login_at).toLocaleString() : 'Never'}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <div className="inline-flex items-center gap-2">
                            {/* Toggle status */}
                            {!isSelf && (
                              <button
                                onClick={() => handleToggleStatus(u)}
                                className={clsx(
                                  'p-1.5 rounded-lg border text-xs font-bold transition-colors cursor-pointer',
                                  u.is_active
                                    ? 'border-slate-200 hover:bg-red-50 hover:text-red-700 text-slate-600'
                                    : 'border-emerald-200 hover:bg-emerald-50 text-emerald-700'
                                )}
                                title={u.is_active ? 'Disable account' : 'Enable account'}
                              >
                                {u.is_active ? <UserX size={14} /> : <UserCheck size={14} />}
                              </button>
                            )}

                            {/* Revoke sessions */}
                            <button
                              onClick={() => handleRevokeSessions(u.id)}
                              className="p-1.5 rounded-lg border border-slate-200 hover:bg-amber-50 hover:text-amber-800 text-slate-600 transition-colors cursor-pointer"
                              title="Revoke active sessions"
                            >
                              <KeyRound size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Audit Logs Overview */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4 shadow-2xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Shield size={18} className="text-slate-700" />
                <h4 className="text-sm font-extrabold text-slate-900">Security Audit Trail</h4>
              </div>
              <span className="text-[11px] font-semibold text-slate-400">
                Latest 15 security events
              </span>
            </div>

            <div className="divide-y divide-slate-100 text-xs">
              {auditLogs.map((log) => (
                <div key={log.id} className="py-2.5 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <span className={clsx(
                      'px-2 py-0.5 rounded text-[10px] font-extrabold uppercase',
                      log.status === 'SUCCESS' ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-800'
                    )}>
                      {log.action}
                    </span>
                    <span className="text-slate-600 font-mono text-[11px]">{log.resource}</span>
                  </div>
                  <div className="text-slate-400 font-mono text-[10.5px]">
                    {new Date(log.timestamp).toLocaleTimeString()} &middot; {new Date(log.timestamp).toLocaleDateString()}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Invite User Modal */}
      {inviteModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <UserPlus size={18} className="text-amber-600" />
                <h3 className="text-sm font-extrabold text-slate-900">Provision Enterprise User</h3>
              </div>
              <button
                onClick={() => setInviteModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleInviteUser} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  value={inviteName}
                  onChange={(e) => setInviteName(e.target.value)}
                  placeholder="e.g. Alex Rivera"
                  className="input text-xs py-2 bg-slate-50 focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Work Email
                </label>
                <input
                  type="email"
                  required
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="e.g. arivera@sentinelai.internal"
                  className="input text-xs py-2 bg-slate-50 focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Role Assignment
                </label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as UserRole)}
                  className="input select text-xs py-2 bg-slate-50 focus:bg-white"
                >
                  <option value="SECURITY_ANALYST">SECURITY_ANALYST (SOC Operator)</option>
                  <option value="ADMIN">ADMIN (Full Platform Access)</option>
                  <option value="VIEWER">VIEWER (Read-Only)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Initial Password (min. 8 characters)
                </label>
                <input
                  type="password"
                  minLength={8}
                  value={invitePassword}
                  onChange={(e) => setInvitePassword(e.target.value)}
                  placeholder="Leave blank if user signs in via SSO"
                  className="input text-xs py-2 bg-slate-50 focus:bg-white"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setInviteModalOpen(false)}
                  className="btn btn-secondary text-xs px-4 py-2 font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={inviteLoading}
                  className="btn btn-primary text-xs px-5 py-2 font-bold flex items-center gap-2 cursor-pointer"
                >
                  {inviteLoading ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      <span>Provisioning...</span>
                    </>
                  ) : (
                    <span>Create User</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </PageContainer>
  );
}
