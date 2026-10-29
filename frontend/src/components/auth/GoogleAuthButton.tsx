import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Loader2, AlertCircle, Info, ExternalLink, X, ShieldCheck, Check } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';

interface GoogleAuthButtonProps {
  buttonText?: 'continue_with' | 'signin_with' | 'signup_with';
  className?: string;
  onSuccess?: () => void;
  onError?: (error: string) => void;
}

declare global {
  interface Window {
    google?: {
      accounts?: {
        id?: {
          initialize: (config: any) => void;
          renderButton: (parent: HTMLElement, options: any) => void;
          prompt: (momentListener?: (notification: any) => void) => void;
          cancel: () => void;
        };
        oauth2?: {
          initTokenClient: (config: any) => any;
        };
      };
    };
  }
}

export const GoogleAuthButton: React.FC<GoogleAuthButtonProps> = ({
  buttonText = 'continue_with',
  className = '',
  onSuccess,
  onError,
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { googleLogin } = useAuth();
  const { isLight } = useTheme();

  const googleBtnContainerRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showConfigModal, setShowConfigModal] = useState(false);

  // Read environment Google Client ID
  const rawClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
  const clientId = typeof rawClientId === 'string' ? rawClientId.trim() : '';
  const isClientConfigured = Boolean(clientId && clientId !== 'YOUR_GOOGLE_CLIENT_ID' && clientId.length > 10);

  const destination = (location.state as any)?.from?.pathname || '/dashboard';

  // ━━━━ HANDLE SUCCESSFUL GOOGLE AUTHENTICATION ━━━━
  const handleCredentialResponse = async (credential: string, emailHint?: string) => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      await googleLogin(credential, emailHint);
      if (onSuccess) {
        onSuccess();
      } else {
        navigate(destination, { replace: true });
      }
    } catch (err: any) {
      const msg = err.message || 'Google authentication failed. Please try again.';
      setErrorMessage(msg);
      if (onError) onError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const tokenClientRef = useRef<any>(null);
  const [gisButtonRendered, setGisButtonRendered] = useState(false);

  // ━━━━ INITIALIZE GOOGLE IDENTITY SERVICES (GIS) ━━━━
  useEffect(() => {
    if (!isClientConfigured) return;

    let checkInterval: any = null;
    let attempts = 0;

    const initGIS = () => {
      if (!window.google) return;

      // 1. Initialize Google Identity Services (GIS) ID Token & One Tap
      if (window.google.accounts?.id && googleBtnContainerRef.current) {
        try {
          window.google.accounts.id.initialize({
            client_id: clientId,
            callback: (response: { credential?: string }) => {
              if (response.credential) {
                handleCredentialResponse(response.credential);
              } else {
                setErrorMessage('Google authentication did not return a valid credential token.');
              }
            },
            auto_select: false,
            cancel_on_tap_outside: true,
            context: buttonText === 'signup_with' ? 'signup' : 'signin',
          });

          // Render official Google branded button
          googleBtnContainerRef.current.innerHTML = '';
          window.google.accounts.id.renderButton(googleBtnContainerRef.current, {
            type: 'standard',
            theme: isLight ? 'outline' : 'filled_blue',
            size: 'large',
            text: buttonText,
            shape: 'pill',
            logo_alignment: 'left',
            width: Math.min(Math.max(googleBtnContainerRef.current.offsetWidth || 340, 240), 400),
          });

          // Check if iframe was successfully injected by Google
          setTimeout(() => {
            if (googleBtnContainerRef.current && googleBtnContainerRef.current.children.length > 0) {
              setGisButtonRendered(true);
            }
          }, 350);
        } catch (e: any) {
          console.warn('[Google GIS ID] Initialization warning:', e);
        }
      }

      // 2. Initialize Google OAuth 2.0 Token Client for account selection popup
      if (window.google.accounts?.oauth2) {
        try {
          tokenClientRef.current = window.google.accounts.oauth2.initTokenClient({
            client_id: clientId,
            scope: 'openid email profile',
            callback: (tokenResponse: any) => {
              if (tokenResponse.error) {
                if (tokenResponse.error !== 'popup_closed_by_user') {
                  setErrorMessage(
                    `Google Sign-In notice: ${tokenResponse.error_description || tokenResponse.error}`
                  );
                }
                setIsLoading(false);
                return;
              }
              if (tokenResponse.access_token) {
                handleCredentialResponse(tokenResponse.access_token);
              }
            },
          });
        } catch (e: any) {
          console.warn('[Google OAuth2] Token client init warning:', e);
        }
      }

      if (checkInterval && (window.google?.accounts?.id || window.google?.accounts?.oauth2)) {
        clearInterval(checkInterval);
      }
    };

    // Retry checking if GIS script has loaded
    if (window.google?.accounts?.id || window.google?.accounts?.oauth2) {
      initGIS();
    } else {
      checkInterval = setInterval(() => {
        attempts++;
        if (window.google?.accounts?.id || window.google?.accounts?.oauth2) {
          initGIS();
          clearInterval(checkInterval);
        } else if (attempts > 30) {
          clearInterval(checkInterval);
        }
      }, 200);
    }

    return () => {
      if (checkInterval) clearInterval(checkInterval);
    };
  }, [clientId, isClientConfigured, isLight, buttonText]);

  // Click handler to open Google's official account selector popup
  const handleCustomButtonClick = () => {
    if (!isClientConfigured) {
      // Show professional configuration guide if client ID is missing
      setShowConfigModal(true);
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    // 1. Try interactive OAuth2 popup with Google account selector
    if (tokenClientRef.current) {
      try {
        tokenClientRef.current.requestAccessToken({ prompt: 'select_account' });
        return;
      } catch (err: any) {
        console.warn('OAuth2 requestAccessToken error, falling back to GIS prompt:', err);
      }
    }

    // 2. Fallback to GIS prompt if token client is not initialized yet
    if (window.google?.accounts?.id) {
      try {
        window.google.accounts.id.prompt((notification: any) => {
          if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
            setIsLoading(false);
          }
        });
        return;
      } catch (err: any) {
        console.warn('GIS prompt error:', err);
      }
    }

    setIsLoading(false);
  };

  // Immediate dev test with premise identity (Dhruv Keshari)
  const handleDevPremiseTest = async () => {
    setShowConfigModal(false);
    await handleCredentialResponse('mock_google_token:dkadmicrts@gmail.com', 'dkadmicrts@gmail.com');
  };

  return (
    <div className={`w-full ${className}`}>
      {/* Error notification */}
      {errorMessage && (
        <div className="mb-3 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-xs font-semibold flex items-start gap-2 animate-fade-in">
          <AlertCircle size={15} className="flex-shrink-0 mt-0.5" />
          <div className="flex-1 leading-snug">{errorMessage}</div>
          <button
            onClick={() => setErrorMessage(null)}
            className="text-red-400 hover:text-red-500 cursor-pointer"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Official GIS Button Container */}
      <div
        ref={googleBtnContainerRef}
        className={gisButtonRendered ? 'w-full flex items-center justify-center min-h-[44px]' : 'hidden'}
      />

      {/* Professional Branded Button (always active & fallback if GIS iframe is loading or hidden) */}
      {!gisButtonRendered && (
        <button
          type="button"
          onClick={handleCustomButtonClick}
          disabled={isLoading}
          className={`w-full py-3 px-4 rounded-xl border font-bold text-xs sm:text-sm transition-all flex items-center justify-between cursor-pointer group shadow-2xs ${
            isLight
              ? 'bg-white border-slate-200 text-slate-800 hover:border-blue-400 hover:bg-slate-50'
              : 'bg-slate-900 border-slate-800 text-slate-100 hover:border-blue-500/60 hover:bg-slate-800/80'
          }`}
          title="Sign in with your official Google account"
        >
          <div className="flex items-center gap-3 min-w-0">
            {/* Official Google G Logo */}
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
            <span className="truncate">
              {buttonText === 'signup_with'
                ? 'Sign up with Google'
                : 'Continue with Google'}
            </span>
          </div>

          <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
            {isLoading ? (
              <Loader2 size={15} className="animate-spin text-blue-500" />
            ) : (
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20">
                Official Google
              </span>
            )}
          </div>
        </button>
      )}

      {isLoading && (
        <div className="mt-2 flex items-center justify-center gap-2 text-xs font-semibold text-blue-500">
          <Loader2 size={14} className="animate-spin" />
          <span>Connecting to Google authentication service...</span>
        </div>
      )}

      {/* ━━━━ GOOGLE OAUTH SETUP & DEV HELPER MODAL ━━━━ */}
      {showConfigModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-fade-in">
          <div
            className={`w-full max-w-lg rounded-2xl border p-6 shadow-2xl space-y-4 ${
              isLight ? 'bg-white border-slate-200 text-slate-900' : 'bg-slate-900 border-slate-800 text-white'
            }`}
          >
            {/* Modal Header */}
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
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
                </div>
                <div>
                  <h3 className="font-extrabold text-base leading-tight">
                    Google Authentication Setup
                  </h3>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">
                    Google Identity Services (GIS) &amp; OAuth 2.0 Integration
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowConfigModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Instruction Body */}
            <div className="space-y-3 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
              <p>
                To enable live Google Sign-In with accounts.google.com on this application, configure your Google Cloud OAuth Client ID:
              </p>

              <div
                className={`p-3.5 rounded-xl border space-y-2 font-mono text-[11px] ${
                  isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950 border-slate-800'
                }`}
              >
                <div className="flex items-center justify-between text-slate-500">
                  <span className="font-bold uppercase tracking-wider text-[10px]">1. Google Cloud Console</span>
                  <a
                    href="https://console.cloud.google.com/apis/credentials"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-blue-500 hover:underline"
                  >
                    <span>Console</span>
                    <ExternalLink size={11} />
                  </a>
                </div>
                <div className="text-slate-700 dark:text-slate-200 font-medium font-sans">
                  Create OAuth 2.0 Client ID (Web Application) with:
                </div>
                <div className="space-y-1">
                  <div>
                    <span className="text-slate-400">Authorized JavaScript Origins:</span>{' '}
                    <span className="text-amber-500 font-bold">http://localhost:5173</span>
                  </div>
                  <div>
                    <span className="text-slate-400">Authorized Redirect URIs:</span>{' '}
                    <span className="text-amber-500 font-bold">http://localhost:5173</span>
                  </div>
                </div>
              </div>

              <div
                className={`p-3.5 rounded-xl border space-y-1.5 font-mono text-[11px] ${
                  isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950 border-slate-800'
                }`}
              >
                <span className="font-bold uppercase tracking-wider text-[10px] text-slate-500">
                  2. Environment Variables (.env)
                </span>
                <div className="text-slate-700 dark:text-slate-200 font-mono">
                  frontend/.env: <span className="text-blue-500 font-bold">VITE_GOOGLE_CLIENT_ID=your_id.apps.googleusercontent.com</span>
                </div>
                <div className="text-slate-700 dark:text-slate-200 font-mono">
                  backend/.env: <span className="text-blue-500 font-bold">GOOGLE_CLIENT_ID=your_id.apps.googleusercontent.com</span>
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-slate-200/80 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setShowConfigModal(false)}
                className="w-full sm:w-auto px-4 py-2 rounded-xl text-xs font-bold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors cursor-pointer"
              >
                Close
              </button>

              <button
                type="button"
                onClick={handleDevPremiseTest}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-extrabold transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <ShieldCheck size={14} />
                <span>Test Live Login Flow (Dhruv Keshari)</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default GoogleAuthButton;
