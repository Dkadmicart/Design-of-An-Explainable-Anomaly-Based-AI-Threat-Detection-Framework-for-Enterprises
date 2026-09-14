import React, { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { Hexagon, Lock, Mail, AlertCircle, Loader2, ArrowRight, ShieldCheck, Check } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, googleLogin } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [activeAccountFill, setActiveAccountFill] = useState<'admin' | 'analyst' | null>(null);

  const destination = (location.state as any)?.from?.pathname || '/dashboard';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;

    setErrorMessage(null);
    setIsLoading(true);

    try {
      await login(email, password);
      navigate(destination, { replace: true });
    } catch (err: any) {
      setErrorMessage(err.message || 'Invalid email or password.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleAuth = async () => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      await googleLogin('mock_google_token_for_verification');
      navigate(destination, { replace: true });
    } catch (err: any) {
      setErrorMessage(
        err.message || 'Your Google account does not have access to SentinelAI. Please contact your administrator.'
      );
    } finally {
      setIsLoading(false);
    }
  };

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

  return (
    <div className="auth-page-wrapper">
      <div className="auth-card-container space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2.5">
          <div
            className="inline-flex items-center gap-3 cursor-pointer group"
            onClick={() => navigate('/')}
          >
            <div className="flex items-center justify-center w-11 h-11 bg-[#F5B700] rounded-xl shadow-xs ring-1 ring-amber-400/50 group-hover:scale-105 transition-transform">
              <Hexagon size={24} className="text-slate-950" strokeWidth={2.5} />
            </div>
            <div className="flex flex-col text-left">
              <span className="text-xl font-black text-slate-950 tracking-tight leading-none">
                SentinelAI
              </span>
              <span className="text-[10px] font-extrabold text-amber-700 tracking-widest uppercase mt-1">
                Enterprise SOC
              </span>
            </div>
          </div>

          <div className="pt-2">
            <span className="text-[11px] font-extrabold text-slate-400 uppercase tracking-widest block mb-1">
              Welcome Back
            </span>
            <h1 className="text-2xl font-black text-slate-950 tracking-tight">
              Sign in to SentinelAI
            </h1>
            <p className="text-xs text-slate-500 font-medium mt-1">
              Secure access to your security operations workspace.
            </p>
          </div>
        </div>

        {/* Main Card */}
        <div className="auth-card space-y-5">
          {/* Error Message */}
          {errorMessage && (
            <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs font-semibold flex items-start gap-2.5 animate-fade-in">
              <AlertCircle size={16} className="text-red-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1 leading-relaxed">{errorMessage}</div>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="auth-field">
              <label className="auth-label">
                Work Email
              </label>
              <div className="auth-input-wrapper">
                <span className="auth-input-icon">
                  <Mail size={17} />
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
                <label className="auth-label mb-0">
                  Password
                </label>
                <Link
                  to="/forgot-password"
                  className="text-xs font-bold text-amber-700 hover:text-amber-800 transition-colors"
                >
                  Forgot password?
                </Link>
              </div>
              <div className="auth-input-wrapper">
                <span className="auth-input-icon">
                  <Lock size={17} />
                </span>
                <input
                  type="password"
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
                  <span>Signing in...</span>
                </>
              ) : (
                <>
                  <span>Sign In</span>
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>

          {/* Clean OR Divider */}
          <div className="relative flex items-center justify-center my-5">
            <div className="w-full border-t border-slate-200" />
            <span className="bg-white px-3 text-[10px] font-extrabold text-slate-400 uppercase tracking-widest absolute">
              OR
            </span>
          </div>

          {/* Google OAuth Button */}
          <div>
            <button
              type="button"
              onClick={handleGoogleAuth}
              disabled={isLoading}
              className="auth-btn-google"
            >
              <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              <span>Continue with Google</span>
            </button>
          </div>

          {/* Access Policy Note */}
          <div className="pt-3 text-center border-t border-slate-100">
            <p className="text-xs text-slate-500 font-medium">
              Need access?{' '}
              <span className="font-bold text-slate-900">
                Contact your administrator.
              </span>
            </p>
          </div>
        </div>

        {/* Enterprise Test Roles Card */}
        <div className="p-4 rounded-2xl bg-amber-50/90 border border-amber-200/90 shadow-2xs space-y-3">
          <div className="flex items-center gap-2 text-amber-900 font-extrabold text-xs">
            <ShieldCheck size={16} className="text-amber-700" />
            <span>Pre-Configured Enterprise Roles</span>
          </div>
          <p className="text-[11px] text-slate-600 font-medium leading-relaxed">
            Click an account below to auto-fill credentials for immediate testing:
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {/* Admin Role */}
            <button
              type="button"
              onClick={() => fillCredentials('admin')}
              className={`p-3 rounded-xl border text-left transition-all cursor-pointer shadow-2xs bg-white ${
                activeAccountFill === 'admin'
                  ? 'border-amber-500 ring-2 ring-amber-400/30'
                  : 'border-amber-200/80 hover:border-amber-400'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold text-slate-900">
                  Administrator
                </span>
                <span className="text-[9.5px] font-bold px-1.5 py-0.5 bg-amber-100 text-amber-900 rounded">
                  ADMIN
                </span>
              </div>
              <div className="text-[10.5px] text-slate-500 font-mono mt-1 truncate">
                admin@sentinelai.internal
              </div>
              {activeAccountFill === 'admin' && (
                <div className="mt-1.5 flex items-center gap-1 text-[10px] font-bold text-emerald-700">
                  <Check size={12} /> Selected
                </div>
              )}
            </button>

            {/* Analyst Role */}
            <button
              type="button"
              onClick={() => fillCredentials('analyst')}
              className={`p-3 rounded-xl border text-left transition-all cursor-pointer shadow-2xs bg-white ${
                activeAccountFill === 'analyst'
                  ? 'border-amber-500 ring-2 ring-amber-400/30'
                  : 'border-amber-200/80 hover:border-amber-400'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold text-slate-900">
                  Security Analyst
                </span>
                <span className="text-[9.5px] font-bold px-1.5 py-0.5 bg-slate-100 text-slate-700 rounded">
                  ANALYST
                </span>
              </div>
              <div className="text-[10.5px] text-slate-500 font-mono mt-1 truncate">
                analyst@sentinelai.internal
              </div>
              {activeAccountFill === 'analyst' && (
                <div className="mt-1.5 flex items-center gap-1 text-[10px] font-bold text-emerald-700">
                  <Check size={12} /> Selected
                </div>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
