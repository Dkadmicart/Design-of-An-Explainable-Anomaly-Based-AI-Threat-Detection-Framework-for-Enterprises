import type {
  DashboardSummary, NetworkEvent, Alert, MLModel, MitreTechnique,
  Dataset, AppSettings, AttackDistribution, InvestigationResult
} from '../types';

const API_BASE = '/api';

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${url}`, {
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    ...options,
  });
  if (!response.ok) {
    throw new Error(`API error ${response.status}: ${response.statusText}`);
  }
  return response.json();
}

export const api = {
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
