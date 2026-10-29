import type {
  DashboardSummary, NetworkEvent, Alert, MLModel, MitreTechnique,
  Dataset, AppSettings, AttackDistribution, InvestigationResult
} from '../types';
import type { User, AuthResponse, AuditLogEntry, InviteUserPayload, UserRole } from '../types/auth';

const API_BASE = '/api';
const TOKEN_KEY = 'sentinelai_access_token';

export function getStoredToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setStoredToken(token: string | null): void {
  try {
    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_KEY);
    }
  } catch {
    // Ignore storage errors
  }
}

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const token = getStoredToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options?.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${url}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let errorDetail = response.statusText;
    try {
      const errData = await response.json();
      if (errData?.detail) {
        errorDetail = errData.detail;
      }
    } catch {
      // Use statusText if body not JSON
    }
    const error = new Error(errorDetail) as Error & { status: number };
    error.status = response.status;
    throw error;
  }
  return response.json();
}

export const api = {
  // Authentication
  auth: {
    login: async (email: string, password: string): Promise<AuthResponse> => {
      const data = await fetchJson<AuthResponse>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      setStoredToken(data.access_token);
      return data;
    },

    register: async (email: string, password: string, display_name?: string): Promise<AuthResponse> => {
      const data = await fetchJson<AuthResponse>('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ email, password, ...(display_name ? { display_name } : {}) }),
      });
      setStoredToken(data.access_token);
      return data;
    },

    googleLogin: async (credential: string, email?: string): Promise<AuthResponse> => {
      const data = await fetchJson<AuthResponse>('/auth/google', {
        method: 'POST',
        body: JSON.stringify({ credential, ...(email ? { email } : {}) }),
      });
      setStoredToken(data.access_token);
      return data;
    },

    me: async (): Promise<User> => {
      return fetchJson<User>('/auth/me');
    },

    logout: async (): Promise<void> => {
      try {
        await fetchJson('/auth/logout', { method: 'POST' });
      } finally {
        setStoredToken(null);
      }
    },

    forgotPassword: async (email: string): Promise<{ status: string; message: string; dev_reset_token?: string | null }> => {
      return fetchJson('/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email }),
      });
    },

    resetPassword: async (token: string, new_password: string): Promise<{ status: string; message: string }> => {
      return fetchJson('/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ token, new_password }),
      });
    },

    getUsers: async (): Promise<User[]> => {
      return fetchJson<User[]>('/auth/users');
    },

    inviteUser: async (payload: InviteUserPayload): Promise<User> => {
      return fetchJson<User>('/auth/users/invite', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    },

    updateUserStatus: async (userId: string, isActive: boolean): Promise<User> => {
      return fetchJson<User>(`/auth/users/${userId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ is_active: isActive }),
      });
    },

    updateUserRole: async (userId: string, role: UserRole): Promise<User> => {
      return fetchJson<User>(`/auth/users/${userId}/role`, {
        method: 'PATCH',
        body: JSON.stringify({ role }),
      });
    },

    revokeUserSessions: async (userId: string): Promise<{ status: string; message: string }> => {
      return fetchJson<{ status: string; message: string }>(`/auth/users/${userId}/revoke-sessions`, {
        method: 'POST',
      });
    },

    getAuditLogs: async (limit: number = 30): Promise<AuditLogEntry[]> => {
      return fetchJson<AuditLogEntry[]>(`/auth/audit-logs?limit=${limit}`);
    },
  },

  // Dashboard
  getDashboardSummary: async (): Promise<DashboardSummary> => {
    return fetchJson<DashboardSummary>('/dashboard/summary');
  },

  // Events
  getEvents: async (params?: {
    page?: number;
    page_size?: number;
    protocol?: string;
    attack_type?: string;
    source_ip?: string;
    destination_ip?: string;
  }): Promise<{ events: NetworkEvent[]; total: number; page: number; page_size: number }> => {
    const query = new URLSearchParams();
    if (params?.page) query.append('page', params.page.toString());
    if (params?.page_size) query.append('page_size', params.page_size.toString());
    if (params?.protocol) query.append('protocol', params.protocol);
    if (params?.attack_type) query.append('attack_type', params.attack_type);
    if (params?.source_ip) query.append('source_ip', params.source_ip);
    if (params?.destination_ip) query.append('destination_ip', params.destination_ip);
    const qs = query.toString() ? `?${query.toString()}` : '';
    return fetchJson(`/events${qs}`);
  },

  getEvent: async (id: string): Promise<{ event: NetworkEvent }> => {
    return fetchJson<{ event: NetworkEvent }>(`/events/${id}`);
  },

  // Alerts
  getAlerts: async (params?: {
    page?: number;
    page_size?: number;
    severity?: string;
    status?: string;
    attack_type?: string;
    source_ip?: string;
  }): Promise<{ alerts: Alert[]; total: number; page: number }> => {
    const query = new URLSearchParams();
    if (params?.page) query.append('page', params.page.toString());
    if (params?.page_size) query.append('page_size', params.page_size.toString());
    if (params?.severity) query.append('severity', params.severity);
    if (params?.status) query.append('status', params.status);
    if (params?.attack_type) query.append('attack_type', params.attack_type);
    if (params?.source_ip) query.append('source_ip', params.source_ip);
    const qs = query.toString() ? `?${query.toString()}` : '';
    return fetchJson(`/alerts${qs}`);
  },

  getAlert: async (id: string): Promise<{ alert: Alert }> => {
    return fetchJson<{ alert: Alert }>(`/alerts/${id}`);
  },

  resolveAlert: async (id: string, notes?: string) => {
    return fetchJson<{ status: string; alert_id: string }>(`/alerts/${id}/resolve`, {
      method: 'POST',
      body: JSON.stringify({ notes }),
    });
  },

  escalateAlert: async (id: string, notes?: string) => {
    return fetchJson<{ status: string; alert_id: string }>(`/alerts/${id}/escalate`, {
      method: 'POST',
      body: JSON.stringify({ notes }),
    });
  },

  confirmAlert: async (id: string, notes?: string) => {
    return fetchJson<{ status: string; alert_id: string }>(`/alerts/${id}/confirm`, {
      method: 'POST',
      body: JSON.stringify({ notes }),
    });
  },

  markBenignAlert: async (id: string, notes?: string) => {
    return fetchJson<{ status: string; alert_id: string }>(`/alerts/${id}/benign`, {
      method: 'POST',
      body: JSON.stringify({ notes }),
    });
  },

  // Models
  getModels: async (): Promise<{ models: MLModel[] }> => {
    return fetchJson<{ models: MLModel[] }>('/models');
  },

  // MITRE ATT&CK
  getMitreTechniques: async (): Promise<{ techniques: MitreTechnique[] }> => {
    return fetchJson<{ techniques: MitreTechnique[] }>('/mitre/techniques');
  },

  // Datasets
  getDatasets: async (): Promise<{ datasets: Dataset[] }> => {
    return fetchJson<{ datasets: Dataset[] }>('/datasets');
  },

  // Analytics
  getAttackDistribution: async (): Promise<{ distribution: AttackDistribution[] }> => {
    return fetchJson<{ distribution: AttackDistribution[] }>('/analytics/attack-distribution');
  },

  // Investigation
  searchEntities: async (q: string): Promise<{ query: string; results: NetworkEvent[]; total: number }> => {
    return fetchJson(`/investigate/search?q=${encodeURIComponent(q)}`);
  },

  investigateIP: async (ip: string): Promise<InvestigationResult> => {
    return fetchJson<InvestigationResult>(`/investigate/ip/${encodeURIComponent(ip)}`);
  },

  // Settings
  getSettings: async (): Promise<AppSettings> => {
    return fetchJson<AppSettings>('/settings');
  },

  updateSettings: async (settings: Partial<AppSettings>): Promise<{ status: string; settings: Partial<AppSettings> }> => {
    return fetchJson('/settings', {
      method: 'PUT',
      body: JSON.stringify(settings),
    });
  },
};
