import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { Hexagon, Lock, KeyRound, CheckCircle2, AlertCircle, Loader2, ArrowRight } from 'lucide-react';
import { api } from '../services/api';

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

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
    <div className="auth-page-wrapper">
      <div className="auth-card-container space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-3">
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
            <h1 className="text-2xl font-black text-slate-950 tracking-tight">
              Create New Password
            </h1>
            <p className="text-xs text-slate-500 font-medium mt-1">
              Set a new secure credential for your enterprise account.
            </p>
          </div>
        </div>

        {/* Card */}
        <div className="auth-card space-y-6">
          {success ? (
            <div className="space-y-4 animate-fade-in text-center">
              <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto ring-1 ring-emerald-200">
                <CheckCircle2 size={24} />
              </div>
              <h3 className="text-base font-extrabold text-slate-900">
                Password Successfully Reset
              </h3>
              <p className="text-xs text-slate-600 font-medium leading-relaxed">
                Your enterprise password has been updated and active sessions have been securely revoked. You may now sign in with your new credential.
              </p>
              <div className="pt-3">
                <button
                  onClick={() => navigate('/login')}
                  className="w-full h-11 inline-flex items-center justify-center gap-2 bg-[#F5B700] hover:bg-[#e0a800] text-slate-950 font-extrabold text-xs rounded-xl shadow-xs transition-all cursor-pointer ring-1 ring-amber-400/40"
                >
                  <span>Sign In with New Password</span>
                  <ArrowRight size={15} />
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {errorMessage && (
                <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs font-semibold flex items-start gap-2.5">
                  <AlertCircle size={16} className="text-red-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1 leading-relaxed">{errorMessage}</div>
                </div>
              )}

              <div>
                <label className="block text-[11.5px] font-extrabold text-slate-700 uppercase tracking-wider mb-2">
                  Recovery Token
                </label>
                <div className="auth-input-wrapper">
                  <div className="auth-input-icon">
                    <KeyRound size={16} />
                  </div>
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

              <div>
                <label className="block text-[11.5px] font-extrabold text-slate-700 uppercase tracking-wider mb-2">
                  New Password (min. 8 characters)
                </label>
                <div className="auth-input-wrapper">
                  <div className="auth-input-icon">
                    <Lock size={16} />
                  </div>
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

              <div>
                <label className="block text-[11.5px] font-extrabold text-slate-700 uppercase tracking-wider mb-2">
                  Confirm New Password
                </label>
                <div className="auth-input-wrapper">
                  <div className="auth-input-icon">
                    <Lock size={16} />
                  </div>
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
                className="w-full mt-2 h-11 flex items-center justify-center gap-2 bg-[#F5B700] hover:bg-[#e0a800] disabled:bg-amber-200 text-slate-950 font-extrabold text-xs rounded-xl shadow-xs transition-all cursor-pointer ring-1 ring-amber-400/40"
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

              <div className="pt-2 text-center border-t border-slate-100">
                <Link
                  to="/login"
                  className="text-xs font-bold text-slate-600 hover:text-slate-950 transition-colors"
                >
                  Return to Sign In
                </Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
