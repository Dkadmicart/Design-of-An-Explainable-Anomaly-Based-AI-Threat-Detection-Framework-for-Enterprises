import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Loader2 } from 'lucide-react';

interface PublicRouteProps {
  children: React.ReactNode;
}

export const PublicRoute: React.FC<PublicRouteProps> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-slate-50">
        <Loader2 className="animate-spin text-amber-500" size={24} />
      </div>
    );
  }

  if (isAuthenticated) {
    const destination = (location.state as any)?.from?.pathname || '/dashboard';
    return <Navigate to={destination} replace />;
  }

  return <>{children}</>;
};
