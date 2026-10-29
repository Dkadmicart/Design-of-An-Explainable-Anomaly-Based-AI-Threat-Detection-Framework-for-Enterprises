import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Hexagon, Mail, ArrowLeft, CheckCircle2, AlertCircle, Loader2, Sun, Moon } from 'lucide-react';
import { api } from '../services/api';
import { useTheme } from '../context/ThemeContext';

export default function ForgotPasswordPage() {
  const navigate = useNavigate();
  const { theme, toggleTheme, isLight } = useTheme();

  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [devToken, setDevToken] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const res = await api.auth.forgotPassword(email);
      setSubmitted(true);
      if (res.dev_reset_token) {
        setDevToken(res.dev_reset_token);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Unable to process reset request. Please try again.');
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
              Reset Your Password
            </h1>
            <p
              className={`text-xs font-medium mt-1 ${
                isLight ? 'text-slate-600' : 'text-slate-400'
              }`}
            >
              Enter your enterprise work email to receive recovery instructions.
            </p>
          </div>
        </div>

        {/* Card */}
        <div className="auth-card space-y-5">
          {submitted ? (
            <div className="space-y-4 animate-fade-in text-center">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center mx-auto ring-1 ring-emerald-500/30">
                <CheckCircle2 size={24} />
              </div>
              <h3
                className={`text-sm font-extrabold ${
                  isLight ? 'text-slate-900' : 'text-white'
                }`}
              >
                Recovery Request Dispatched
              </h3>
              <p
                className={`text-xs font-medium leading-relaxed ${
                  isLight ? 'text-slate-600' : 'text-slate-400'
                }`}
              >
                If an account associated with <span className="font-bold text-amber-500">{email}</span> exists in SentinelAI, password reset instructions have been generated.
              </p>

              {devToken && (
                <div
                  className={`mt-4 p-3.5 rounded-xl border text-left text-xs ${
                    isLight
                      ? 'bg-amber-50/80 border-amber-200 text-slate-800'
                      : 'bg-amber-500/10 border-amber-500/30 text-amber-200'
                  }`}
                >
                  <span className="font-bold block mb-1">Local Evaluation Token:</span>
                  <code className="text-[11px] font-mono break-all p-2 rounded block bg-black/20 text-amber-400">
                    {devToken}
                  </code>
                  <div className="mt-2.5 text-right">
                    <Link
                      to={`/reset-password?token=${encodeURIComponent(devToken)}`}
                      className="text-xs font-extrabold text-amber-500 hover:text-amber-400 underline"
                    >
                      Proceed to Reset Form &rarr;
                    </Link>
                  </div>
                </div>
              )}

              <div
                className={`pt-3 border-t ${
                  isLight ? 'border-slate-100' : 'border-slate-800'
                }`}
              >
                <Link
                  to="/login"
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-500 hover:text-amber-400 transition-colors"
                >
                  <ArrowLeft size={14} />
                  <span>Return to Sign In</span>
                </Link>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {errorMessage && (
                <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-500 text-xs font-semibold flex items-start gap-2.5 animate-fade-in">
                  <AlertCircle size={16} className="text-red-500 flex-shrink-0 mt-0.5" />
                  <div className="flex-1 leading-relaxed">{errorMessage}</div>
                </div>
              )}

              <div className="auth-field">
                <label className="auth-label">Enterprise Work Email</label>
                <div className="auth-input-wrapper">
                  <span className="auth-input-icon">
                    <Mail size={16} />
                  </span>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="analyst@sentinelai.internal"
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
                    <span>Dispatching Request...</span>
                  </>
                ) : (
                  <span>Send Recovery Instructions</span>
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
                  <span>Back to Sign In</span>
                </Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
