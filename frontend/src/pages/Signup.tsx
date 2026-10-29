import React, { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import {
  Hexagon,
  Lock,
  Mail,
  User as UserIcon,
  AlertCircle,
  Loader2,
  ArrowRight,
  Eye,
  EyeOff,
  Sun,
  Moon,
  ArrowLeft,
  Check,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import GoogleAuthButton from '../components/auth/GoogleAuthButton';

export default function SignupPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { register } = useAuth();
  const { theme, toggleTheme, isLight } = useTheme();

  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const destination = (location.state as any)?.from?.pathname || '/dashboard';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;

    if (password.length < 8) {
      setErrorMessage('Password must be at least 8 characters long.');
      return;
    }

    setErrorMessage(null);
    setIsLoading(true);

    try {
      await register(email.trim(), password, displayName.trim());
      navigate(destination, { replace: true });
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to create account. Please try again.');
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
              Create Your Account
            </h1>
            <p
              className={`text-xs font-medium mt-1 ${
                isLight ? 'text-slate-600' : 'text-slate-400'
              }`}
            >
              Join SentinelAI SOC with official Google SSO or enterprise credentials.
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

          {/* ── 1. OFFICIAL GOOGLE SSO BUTTON ON TOP ── */}
          <div>
            <GoogleAuthButton
              buttonText="signup_with"
              onError={(err) => setErrorMessage(err)}
            />
          </div>

          {/* ── 2. CLEAN OR DIVIDER ── */}
          <div className="flex items-center gap-4 my-5">
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
              OR WORK EMAIL
            </span>
            <div
              className={`flex-1 h-px ${
                isLight ? 'bg-slate-200' : 'bg-slate-800'
              }`}
            />
          </div>

          {/* ── 3. MANUAL SIGNUP FORM ── */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="auth-field">
              <label className="auth-label">Full Name</label>
              <div className="auth-input-wrapper">
                <span className="auth-input-icon">
                  <UserIcon size={16} />
                </span>
                <input
                  type="text"
                  required
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Dhruv Keshari"
                  disabled={isLoading}
                  className="auth-input"
                />
              </div>
            </div>

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
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="analyst@sentinelai.internal"
                  disabled={isLoading}
                  className="auth-input"
                />
              </div>
            </div>

            <div className="auth-field">
              <label className="auth-label">Password (min. 8 characters)</label>
              <div className="auth-input-wrapper">
                <span className="auth-input-icon">
                  <Lock size={16} />
                </span>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
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

            <button
              type="submit"
              disabled={isLoading}
              className="auth-btn-primary"
            >
              {isLoading ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>Creating Account...</span>
                </>
              ) : (
                <>
                  <span>Create Account</span>
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>

          {/* Switch to Login Link */}
          <div
            className={`pt-3 text-center border-t text-xs font-medium ${
              isLight
                ? 'border-slate-100 text-slate-500'
                : 'border-slate-800/80 text-slate-400'
            }`}
          >
            Already have an account?{' '}
            <Link
              to="/login"
              className="font-bold text-amber-500 hover:text-amber-400 transition-colors"
            >
              Sign In here
            </Link>
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
