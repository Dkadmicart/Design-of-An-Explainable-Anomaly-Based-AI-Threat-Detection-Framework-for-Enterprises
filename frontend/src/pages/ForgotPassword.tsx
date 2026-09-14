import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Hexagon, Mail, ArrowLeft, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { api } from '../services/api';

export default function ForgotPasswordPage() {
  const navigate = useNavigate();
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
              Reset Your Password
            </h1>
            <p className="text-xs text-slate-500 font-medium mt-1">
              Enter your enterprise email to receive secure recovery instructions.
            </p>
          </div>
        </div>

        {/* Card */}
        <div className="auth-card space-y-6">
          {submitted ? (
            <div className="space-y-4 animate-fade-in text-center">
              <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto ring-1 ring-emerald-200">
                <CheckCircle2 size={24} />
              </div>
              <h3 className="text-sm font-extrabold text-slate-900">
                Recovery Request Dispatched
              </h3>
              <p className="text-xs text-slate-600 font-medium leading-relaxed">
                If an account associated with <span className="font-bold text-slate-900">{email}</span> exists in SentinelAI, password reset instructions have been generated.
              </p>

              {devToken && (
                <div className="mt-4 p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-left text-xs">
                  <span className="font-bold text-slate-700 block mb-1">Local Development Token:</span>
                  <code className="text-[11px] font-mono text-amber-800 break-all bg-amber-50 p-2 rounded block">
                    {devToken}
                  </code>
                  <div className="mt-2.5 text-right">
                    <Link
                      to={`/reset-password?token=${encodeURIComponent(devToken)}`}
                      className="text-xs font-extrabold text-amber-700 hover:text-amber-800 underline"
                    >
                      Proceed to Reset Form &rarr;
                    </Link>
                  </div>
                </div>
              )}

              <div className="pt-3 border-t border-slate-100">
                <Link
                  to="/login"
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-700 hover:text-slate-950 transition-colors"
                >
                  <ArrowLeft size={14} />
                  <span>Return to Sign In</span>
                </Link>
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
                  Work Email Address
                </label>
                <div className="auth-input-wrapper">
                  <div className="auth-input-icon">
                    <Mail size={16} />
                  </div>
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
                className="w-full mt-2 h-11 flex items-center justify-center gap-2 bg-[#F5B700] hover:bg-[#e0a800] disabled:bg-amber-200 text-slate-950 font-extrabold text-xs rounded-xl shadow-xs transition-all cursor-pointer ring-1 ring-amber-400/40"
              >
                {isLoading ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>Processing...</span>
                  </>
                ) : (
                  <span>Send Recovery Instructions</span>
                )}
              </button>

              <div className="pt-2 text-center border-t border-slate-100">
                <Link
                  to="/login"
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-slate-950 transition-colors"
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
