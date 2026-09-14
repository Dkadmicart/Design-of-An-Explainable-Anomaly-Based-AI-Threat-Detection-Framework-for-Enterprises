import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { ShieldAlert, Loader2 } from 'lucide-react';
import type { UserRole } from '../../types/auth';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: UserRole | UserRole[];
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, requiredRole }) => {
  const { isAuthenticated, isLoading, user } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen w-full flex flex-col items-center justify-center bg-slate-50 text-slate-700">
        <div className="flex items-center gap-3 px-6 py-4 bg-white rounded-2xl border border-slate-200 shadow-sm">
          <Loader2 className="animate-spin text-amber-500" size={24} />
          <span className="text-sm font-bold text-slate-900">Verifying security session...</span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    // Redirect to /login and preserve destination in location state
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // RBAC permission verification
  if (requiredRole) {
    const roles = Array.isArray(requiredRole) ? requiredRole : [requiredRole];
    if (!roles.includes(user.role)) {
      return (
        <div className="min-h-[70vh] flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-white rounded-2xl border border-red-200 p-8 shadow-sm text-center space-y-4">
            <div className="w-12 h-12 rounded-xl bg-red-50 text-red-600 flex items-center justify-center mx-auto ring-1 ring-red-200">
              <ShieldAlert size={26} />
            </div>
            <h3 className="text-lg font-extrabold text-slate-900">Access Restricted</h3>
            <p className="text-xs text-slate-600 font-medium leading-relaxed">
              You do not possess the required security authorization to view this section.
              Please contact your SOC Administrator if elevated permissions are required.
            </p>
            <div className="pt-2">
              <span className="inline-block text-[11px] font-bold px-3 py-1 bg-slate-100 text-slate-700 rounded-lg border border-slate-200">
                Your Role: {user.role}
              </span>
            </div>
          </div>
        </div>
      );
    }
  }

  return <>{children}</>;
};
