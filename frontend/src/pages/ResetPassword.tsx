import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { Hexagon, Lock, KeyRound, CheckCircle2, AlertCircle, Loader2, ArrowRight, ArrowLeft, Sun, Moon } from 'lucide-react';
import { api } from '../services/api';
import { useTheme } from '../context/ThemeContext';

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { theme, toggleTheme, isLight } = useTheme();

  const [token, setToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const queryToken = searchParams.get('token');
    if (queryToken) {
      setToken(queryToken);
    }
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;

    if (!token.trim()) {
      setErrorMessage('A valid recovery token is required.');
      return;
    }

    if (newPassword.length < 8) {
      setErrorMessage('Password must be at least 8 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMessage('Passwords do not match.');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      await api.auth.resetPassword(token.trim(), newPassword);
      setSuccess(true);
    } catch (err: any) {
      setErrorMessage(err.message || 'Password reset failed. Token may be expired or invalid.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      data-theme={theme}
      className="auth-page-wrapper selection:bg-amber-400 selection:text-slate-950"
    >
      {/* Top Utility Bar */}
      <header className="w-full max-w-4xl mx-auto flex items-center justify-between pb-6 sm:pb-8 pt-1">
        <Link
          to="/login"
          className={`inline-flex items-center gap-2 text-xs font-bold transition-all px-3 py-1.5 rounded-xl border ${
            isLight
              ? 'text-slate-600 hover:text-slate-950 bg-white hover:bg-slate-50 border-slate-200'
              : 'text-slate-400 hover:text-white bg-slate-900/60 hover:bg-slate-800/80 border-slate-800'
          }`}
        >
          <ArrowLeft size={14} />
          <span>Back to Sign In</span>
        </Link>

        {/* Theme Toggle Button */}
        <button
          onClick={toggleTheme}
          className={`theme-toggle rounded-full ${isLight ? 'border-slate-300' : 'border-white/20'}`}
          aria-label="Toggle dark/light theme"
          title={isLight ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
        >
          <div className="theme-toggle-knob rounded-full">
            {isLight ? (
              <Moon size={12} className="text-white" />
            ) : (
              <Sun size={12} className="text-slate-950" />
            )}
          </div>
        </button>
      </header>

      <div className="auth-card-container space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div
            className="inline-flex items-center gap-3 cursor-pointer group"
            onClick={() => navigate('/')}
          >
            <div className="flex items-center justify-center w-11 h-11 bg-[#F5B700] rounded-xl shadow-[0_0_20px_rgba(245,183,0,0.35)] ring-1 ring-amber-400/50 group-hover:scale-105 transition-transform">
              <Hexagon size={24} className="text-slate-950" strokeWidth={2.5} />
            </div>
            <div className="flex flex-col text-left">
              <span
                className={`text-xl font-black tracking-tight leading-none ${
                  isLight ? 'text-slate-950' : 'text-white'
                }`}
              >
                SentinelAI
              </span>
              <span className="text-[10px] font-extrabold text-amber-500 tracking-widest uppercase mt-1">
                Security Operations
              </span>
            </div>
          </div>

          <div className="pt-2">
            <h1
              className={`text-2xl font-black tracking-tight ${
                isLight ? 'text-slate-900' : 'text-slate-100'
              }`}
            >
              Create New Password
            </h1>
            <p
              className={`text-xs font-medium mt-1 ${
                isLight ? 'text-slate-600' : 'text-slate-400'
              }`}
            >
              Set a new secure credential for your enterprise account.
            </p>
          </div>
        </div>

        {/* Card */}
        <div className="auth-card space-y-5">
          {success ? (
            <div className="space-y-4 animate-fade-in text-center">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center mx-auto ring-1 ring-emerald-500/30">
                <CheckCircle2 size={24} />
              </div>
              <h3
                className={`text-base font-extrabold ${
                  isLight ? 'text-slate-900' : 'text-white'
                }`}
              >
                Password Successfully Reset
              </h3>
              <p
                className={`text-xs font-medium leading-relaxed ${
                  isLight ? 'text-slate-600' : 'text-slate-400'
                }`}
              >
                Your enterprise password has been updated and active sessions have been securely revoked. You may now sign in with your new credential.
              </p>
              <div className="pt-3">
                <button
                  onClick={() => navigate('/login')}
                  className="auth-btn-primary"
                >
                  <span>Sign In with New Password</span>
                  <ArrowRight size={16} />
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {errorMessage && (
                <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-500 text-xs font-semibold flex items-start gap-2.5">
                  <AlertCircle size={16} className="text-red-500 flex-shrink-0 mt-0.5" />
                  <div className="flex-1 leading-relaxed">{errorMessage}</div>
                </div>
              )}

              <div className="auth-field">
                <label className="auth-label">Recovery Token</label>
                <div className="auth-input-wrapper">
                  <span className="auth-input-icon">
                    <KeyRound size={16} />
                  </span>
                  <input
                    type="text"
                    required
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                    placeholder="Paste recovery token"
                    disabled={isLoading}
                    className="auth-input font-mono text-xs"
                  />
                </div>
              </div>

              <div className="auth-field">
                <label className="auth-label">New Password (min. 8 characters)</label>
                <div className="auth-input-wrapper">
                  <span className="auth-input-icon">
                    <Lock size={16} />
                  </span>
                  <input
                    type="password"
                    required
                    minLength={8}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="••••••••••••"
                    disabled={isLoading}
                    className="auth-input"
                  />
                </div>
              </div>

              <div className="auth-field">
                <label className="auth-label">Confirm New Password</label>
                <div className="auth-input-wrapper">
                  <span className="auth-input-icon">
                    <Lock size={16} />
                  </span>
                  <input
                    type="password"
                    required
                    minLength={8}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••••••"
                    disabled={isLoading}
                    className="auth-input"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="auth-btn-primary"
              >
                {isLoading ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>Updating Password...</span>
                  </>
                ) : (
                  <span>Update Password</span>
                )}
              </button>

              <div className="pt-2 text-center">
                <Link
                  to="/login"
                  className={`inline-flex items-center gap-1.5 text-xs font-bold transition-colors ${
                    isLight
                      ? 'text-slate-600 hover:text-slate-900'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <ArrowLeft size={14} />
                  <span>Return to Sign In</span>
                </Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
