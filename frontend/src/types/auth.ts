export type UserRole = 'ADMIN' | 'SECURITY_ANALYST' | 'VIEWER';

export interface User {
  id: string;
  email: string;
  display_name: string;
  role: UserRole;
  is_active: boolean;
  mfa_enabled: boolean;
  organization_id?: string | null;
  created_at: string;
  last_login_at?: string | null;
  auth_providers: string[];
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  user: User;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  user_id?: string | null;
  action: string;
  resource: string;
  status: string;
  ip_address?: string | null;
  details?: Record<string, any> | null;
}

export interface InviteUserPayload {
  email: string;
  display_name: string;
  role: UserRole;
  initial_password?: string;
}
