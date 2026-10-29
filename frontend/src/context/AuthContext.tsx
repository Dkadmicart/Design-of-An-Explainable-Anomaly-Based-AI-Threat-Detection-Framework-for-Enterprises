import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { User, AuthResponse } from '../types/auth';
import { api, getStoredToken, setStoredToken } from '../services/api';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<AuthResponse>;
  register: (email: string, password: string, display_name?: string) => Promise<AuthResponse>;
  googleLogin: (credential: string, email?: string) => Promise<AuthResponse>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(getStoredToken());
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Initialize and verify existing session
  const verifySession = useCallback(async () => {
    const existingToken = getStoredToken();
    if (!existingToken) {
      setUser(null);
      setIsLoading(false);
      return;
    }

    try {
      const currentUser = await api.auth.me();
      setUser(currentUser);
      setToken(existingToken);
    } catch {
      // Session invalid or expired
      setStoredToken(null);
      setToken(null);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    verifySession();
  }, [verifySession]);

  const login = async (email: string, password: string): Promise<AuthResponse> => {
    setIsLoading(true);
    try {
      const resp = await api.auth.login(email, password);
      setToken(resp.access_token);
      setUser(resp.user);
      return resp;
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (email: string, password: string, display_name?: string): Promise<AuthResponse> => {
    setIsLoading(true);
    try {
      const resp = await api.auth.register(email, password, display_name);
      setToken(resp.access_token);
      setUser(resp.user);
      return resp;
    } finally {
      setIsLoading(false);
    }
  };

  const googleLogin = async (credential: string, email?: string): Promise<AuthResponse> => {
    setIsLoading(true);
    try {
      const resp = await api.auth.googleLogin(credential, email);
      setToken(resp.access_token);
      setUser(resp.user);
      return resp;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    setIsLoading(true);
    try {
      await api.auth.logout();
    } catch (e) {
      console.warn('Logout notification error:', e);
    } finally {
      setToken(null);
      setUser(null);
      setIsLoading(false);
    }
  };

  const refreshUser = async () => {
    try {
      const updated = await api.auth.me();
      setUser(updated);
    } catch {
      // Ignore refresh error
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        isAuthenticated: !!user && !!token,
        login,
        register,
        googleLogin,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
