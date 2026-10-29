import React, { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import {
  Hexagon,
  Lock,
  Mail,
  AlertCircle,
  Loader2,
  ArrowRight,
  ShieldCheck,
  Check,
  Eye,
  EyeOff,
  Sun,
  Moon,
  ArrowLeft,
  Zap,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import GoogleAuthButton from '../components/auth/GoogleAuthButton';

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();
  const { theme, toggleTheme, isLight } = useTheme();

  // Manual Form State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [authActionText, setAuthActionText] = useState('Signing in...');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [activeAccountFill, setActiveAccountFill] = useState<'admin' | 'analyst' | null>(null);

  const destination = (location.state as any)?.from?.pathname || '/dashboard';

  // ━━━━ MANUAL FORM SUBMISSION ━━━━
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;

    setErrorMessage(null);
    setIsLoading(true);
    setAuthActionText('Authenticating credentials...');

    try {
      await login(email.trim(), password);
      navigate(destination, { replace: true });
    } catch (err: any) {
      setErrorMessage(err.message || 'Invalid email or password. Please verify your credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  // Auto-Fill Form Fields for Pre-Configured Enterprise Roles
  const fillCredentials = (role: 'admin' | 'analyst') => {
    setActiveAccountFill(role);
    if (role === 'admin') {
      setEmail('admin@sentinelai.internal');
      setPassword('SentinelAdmin2026!');
    } else {
      setEmail('analyst@sentinelai.internal');
      setPassword('SentinelAnalyst2026!');
    }
    setErrorMessage(null);
  };

  // Immediate 1-Click Test Sign-In for Pre-Configured Enterprise Roles
  const quickSignIn = async (role: 'admin' | 'analyst') => {
    if (isLoading) return;
    setActiveAccountFill(role);
    setErrorMessage(null);
    setIsLoading(true);

    const userEmail = role === 'admin' ? 'admin@sentinelai.internal' : 'analyst@sentinelai.internal';
    const userPass = role === 'admin' ? 'SentinelAdmin2026!' : 'SentinelAnalyst2026!';
    setEmail(userEmail);
    setPassword(userPass);
    setAuthActionText(`Instant login as ${role === 'admin' ? 'Administrator' : 'Analyst'}...`);

    try {
      await login(userEmail, userPass);
      navigate(destination, { replace: true });
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to authenticate role.');
    } finally {
      setIsLoading(false);
    }
  };



  return (
    <div
      data-theme={theme}
      className="auth-page-wrapper selection:bg-amber-400 selection:text-slate-950"
    >
      {/* ━━━━ TOP UTILITY / NAVIGATION BAR ━━━━ */}
      <header className="w-full max-w-4xl mx-auto flex items-center justify-between pb-6 sm:pb-8 pt-1">
        {/* Back Link */}
        <Link
          to="/"
          className={`inline-flex items-center gap-2 text-xs font-bold transition-all px-3 py-1.5 rounded-xl border ${
            isLight
              ? 'text-slate-600 hover:text-slate-950 bg-white hover:bg-slate-50 border-slate-200'
              : 'text-slate-400 hover:text-white bg-slate-900/60 hover:bg-slate-800/80 border-slate-800'
          }`}
          title="Return to SentinelAI Landing Page"
        >
          <ArrowLeft size={14} />
          <span>Platform Overview</span>
        </Link>

        {/* Right Status + Theme Switcher */}
        <div className="flex items-center gap-3">
          <div
            className={`hidden sm:flex items-center gap-2 text-[11px] font-mono px-3 py-1.5 rounded-full border ${
              isLight
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : 'bg-emerald-950/40 text-emerald-400 border-emerald-800/50'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>SOC Operational</span>
          </div>

          {/* Theme Toggle Button (Available anytime) */}
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
        </div>
      </header>

      {/* ━━━━ MAIN AUTH CONTAINER ━━━━ */}
      <div className="auth-card-container">
        {/* Brand Header */}
        <div className="text-center space-y-2 mb-6">
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
                Enterprise SOC Portal
              </span>
            </div>
          </div>

          <div className="pt-2">
            <h1
              className={`text-2xl font-black tracking-tight ${
                isLight ? 'text-slate-900' : 'text-slate-100'
              }`}
            >
              Sign In to Your Workspace
            </h1>
            <p
              className={`text-xs font-medium mt-1 ${
                isLight ? 'text-slate-600' : 'text-slate-400'
              }`}
            >
              Authenticate via company credentials or connect using your active Google identity.
            </p>
          </div>
        </div>

        {/* ━━━━ PRIMARY AUTHENTICATION CARD ━━━━ */}
        <div className="auth-card space-y-5">
          {/* Error Message Alert */}
          {errorMessage && (
            <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-500 text-xs font-semibold flex items-start gap-2.5 animate-fade-in">
              <AlertCircle size={16} className="text-red-500 flex-shrink-0 mt-0.5" />
              <div className="flex-1 leading-relaxed">{errorMessage}</div>
            </div>
          )}

          {/* ── 1. FORM WITH SIGN IN OPTION ON TOP ── */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="auth-field">
              <label className="auth-label">Work Email</label>
              <div className="auth-input-wrapper">
                <span className="auth-input-icon">
                  <Mail size={16} />
                </span>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setActiveAccountFill(null);
                  }}
                  placeholder="analyst@sentinelai.internal"
                  disabled={isLoading}
                  className="auth-input"
                />
              </div>
            </div>

            <div className="auth-field">
              <div className="flex items-center justify-between mb-1">
                <label className="auth-label mb-0">Password</label>
                <Link
                  to="/forgot-password"
                  className="text-xs font-bold text-amber-500 hover:text-amber-400 transition-colors"
                >
                  Forgot password?
                </Link>
              </div>
              <div className="auth-input-wrapper">
                <span className="auth-input-icon">
                  <Lock size={16} />
                </span>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setActiveAccountFill(null);
                  }}
                  placeholder="••••••••••••"
                  disabled={isLoading}
                  className="auth-input"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className={`absolute right-3 top-1/2 -translate-y-1/2 transition-colors cursor-pointer ${
                    isLight ? 'text-slate-400 hover:text-slate-600' : 'text-slate-500 hover:text-slate-300'
                  }`}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Sign In Primary Action Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="auth-btn-primary"
            >
              {isLoading && !authActionText.includes('Google') ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>{authActionText}</span>
                </>
              ) : (
                <>
                  <span>Sign In</span>
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>

          {/* ── 2. EFFECTIVE SPACING WITH "OR" WORD BETWEEN SIGN IN & GOOGLE ── */}
          <div className="flex items-center gap-4 my-6 sm:my-7">
            <div
              className={`flex-1 h-px ${
                isLight ? 'bg-slate-200' : 'bg-slate-800'
              }`}
            />
            <span
              className={`text-[11px] font-black uppercase tracking-widest px-2 py-0.5 rounded ${
                isLight ? 'bg-slate-100 text-slate-500' : 'bg-slate-900 text-slate-400'
              }`}
            >
              OR
            </span>
            <div
              className={`flex-1 h-px ${
                isLight ? 'bg-slate-200' : 'bg-slate-800'
              }`}
            />
          </div>

          {/* ── 3. OFFICIAL GOOGLE IDENTITY SSO ── */}
          <div>
            <GoogleAuthButton
              buttonText="signin_with"
              onError={(err) => setErrorMessage(err)}
            />
          </div>

          {/* New Account / Sign Up Link */}
          <div className="pt-2 text-center text-xs">
            <span className={isLight ? 'text-slate-500' : 'text-slate-400'}>
              Don't have an enterprise account?{' '}
            </span>
            <Link
              to="/signup"
              className="font-bold text-amber-500 hover:text-amber-400 transition-colors"
            >
              Sign up here
            </Link>
          </div>

          {/* Access Policy Note */}
          <div
            className={`pt-3 text-center border-t text-xs font-medium ${
              isLight
                ? 'border-slate-100 text-slate-500'
                : 'border-slate-800/80 text-slate-400'
            }`}
          >
            Need access to SentinelAI?{' '}
            <span
              className={`font-bold ${isLight ? 'text-slate-900' : 'text-slate-200'}`}
            >
              Contact your SecOps Administrator.
            </span>
          </div>
        </div>

        {/* ━━━━ GENEROUS PHYSICAL SPACING BEFORE PRE-CONFIGURED ENTERPRISE ROLES ━━━━ */}
        <div className="h-8 sm:h-10 w-full" />

        {/* ━━━━ PRE-CONFIGURED ENTERPRISE ROLES SECTION (CONTENT SEPARATE FROM EACH OTHER) ━━━━ */}
        <div className="space-y-4">
          {/* Section Heading */}
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-500">
                <ShieldCheck size={16} />
              </div>
              <div>
                <h3
                  className={`text-xs font-black tracking-wide uppercase ${
                    isLight ? 'text-slate-900' : 'text-slate-100'
                  }`}
                >
                  Pre-Configured Enterprise Roles
                </h3>
                <p
                  className={`text-[11px] font-medium leading-none mt-0.5 ${
                    isLight ? 'text-slate-600' : 'text-slate-400'
                  }`}
                >
                  Dedicated evaluation test accounts with 1-click immediate access:
                </p>
              </div>
            </div>
            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-500 border border-amber-500/30">
              EVALUATION
            </span>
          </div>

          {/* ── ROLE 1 CARD: SOC ADMINISTRATOR (STANDALONE CARD) ── */}
          <div
            className={`rounded-2xl border p-4 sm:p-5 transition-all shadow-xs ${
              activeAccountFill === 'admin'
                ? 'border-amber-500 ring-2 ring-amber-400/30 bg-amber-500/[0.06]'
                : isLight
                ? 'bg-white border-amber-200 hover:border-amber-400'
                : 'bg-slate-900/80 border-slate-800 hover:border-amber-500/40'
            }`}
          >
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <span
                    className={`text-sm font-black ${
                      isLight ? 'text-slate-900' : 'text-white'
                    }`}
                  >
                    SOC Administrator
                  </span>
                  <span className="text-[9.5px] font-mono font-black px-2 py-0.5 bg-amber-500/20 text-amber-500 rounded border border-amber-500/30">
                    ADMIN
                  </span>
                </div>
                <div
                  className={`text-xs font-mono font-semibold ${
                    isLight ? 'text-slate-700' : 'text-slate-300'
                  }`}
                >
                  admin@sentinelai.internal
                </div>
                <div className="text-[11px] text-slate-500 font-medium">
                  Full Clearance: System Health, ML Model Ops, User Directory &amp; Audit Logs
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2.5 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => quickSignIn('admin')}
                  disabled={isLoading}
                  className="py-2 px-3.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Zap size={14} />
                  <span>1-Click Login</span>
                </button>
                <button
                  type="button"
                  onClick={() => fillCredentials('admin')}
                  disabled={isLoading}
                  className={`py-2 px-3.5 rounded-xl border font-bold text-xs transition-all cursor-pointer ${
                    activeAccountFill === 'admin'
                      ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30'
                      : isLight
                      ? 'border-slate-200 text-slate-700 hover:bg-slate-100'
                      : 'border-slate-700 text-slate-300 hover:bg-slate-800'
                  }`}
                  title="Auto-fill form credentials"
                >
                  {activeAccountFill === 'admin' ? (
                    <span className="flex items-center gap-1">
                      <Check size={13} /> Filled
                    </span>
                  ) : (
                    'Fill Form'
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* ── DISTINCT BREAK LINE SEPARATING BOTH ROLES ── */}
          <div className="flex items-center gap-3 my-2 px-2">
            <div
              className={`flex-1 h-px ${
                isLight ? 'bg-amber-200/90' : 'bg-slate-800'
              }`}
            />
            <span
              className={`text-[9.5px] font-mono font-bold uppercase tracking-widest ${
                isLight ? 'text-amber-700/70' : 'text-slate-500'
              }`}
            >
              Role Alternative
            </span>
            <div
              className={`flex-1 h-px ${
                isLight ? 'bg-amber-200/90' : 'bg-slate-800'
              }`}
            />
          </div>

          {/* ── ROLE 2 CARD: SECURITY ANALYST (STANDALONE CARD) ── */}
          <div
            className={`rounded-2xl border p-4 sm:p-5 transition-all shadow-xs ${
              activeAccountFill === 'analyst'
                ? 'border-cyan-500 ring-2 ring-cyan-400/30 bg-cyan-500/[0.06]'
                : isLight
                ? 'bg-white border-slate-200 hover:border-cyan-400'
                : 'bg-slate-900/80 border-slate-800 hover:border-cyan-500/40'
            }`}
          >
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <span
                    className={`text-sm font-black ${
                      isLight ? 'text-slate-900' : 'text-white'
                    }`}
                  >
                    SecOps Security Analyst
                  </span>
                  <span className="text-[9.5px] font-mono font-black px-2 py-0.5 bg-cyan-500/20 text-cyan-400 rounded border border-cyan-500/30">
                    ANALYST
                  </span>
                </div>
                <div
                  className={`text-xs font-mono font-semibold ${
                    isLight ? 'text-slate-700' : 'text-slate-300'
                  }`}
                >
                  analyst@sentinelai.internal
                </div>
                <div className="text-[11px] text-slate-500 font-medium">
                  Tier-2 Clearance: Live Telemetry, Alert Triage &amp; TreeSHAP Explainability
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2.5 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => quickSignIn('analyst')}
                  disabled={isLoading}
                  className="py-2 px-3.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Zap size={14} />
                  <span>1-Click Login</span>
                </button>
                <button
                  type="button"
                  onClick={() => fillCredentials('analyst')}
                  disabled={isLoading}
                  className={`py-2 px-3.5 rounded-xl border font-bold text-xs transition-all cursor-pointer ${
                    activeAccountFill === 'analyst'
                      ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30'
                      : isLight
                      ? 'border-slate-200 text-slate-700 hover:bg-slate-100'
                      : 'border-slate-700 text-slate-300 hover:bg-slate-800'
                  }`}
                  title="Auto-fill form credentials"
                >
                  {activeAccountFill === 'analyst' ? (
                    <span className="flex items-center gap-1">
                      <Check size={13} /> Filled
                    </span>
                  ) : (
                    'Fill Form'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Footer / Security Assurance */}
        <div className="text-center text-[11px] text-slate-500 pt-8 space-y-1">
          <p className="font-mono">
            Argon2id Key Derivation • TLS 1.3 End-to-End • SOC-2 Type II
          </p>
        </div>
      </div>
    </div>
  );
}
