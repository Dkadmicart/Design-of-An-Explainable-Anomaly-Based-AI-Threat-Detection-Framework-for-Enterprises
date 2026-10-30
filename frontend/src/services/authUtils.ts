export const DEMO_CREDENTIALS = {
  admin: {
    email: 'admin@sentinelai.internal',
    password: 'SentinelAdmin2026!',
    role: 'ADMIN',
  },
  analyst: {
    email: 'analyst@sentinelai.internal',
    password: 'SentinelAnalyst2026!',
    role: 'ANALYST',
  },
} as const;

export type DemoRole = keyof typeof DEMO_CREDENTIALS;

export function validateWorkEmail(email: string): { isValid: boolean; normalized: string; error?: string } {
  const trimmed = email.trim();
  if (!trimmed) {
    return { isValid: false, normalized: '', error: 'Please enter your work email.' };
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(trimmed)) {
    return {
      isValid: false,
      normalized: trimmed,
      error: 'Please enter a valid work email address (e.g. analyst@sentinelai.internal).',
    };
  }
  return { isValid: true, normalized: trimmed };
}

export function selectDemoCredentials(role: DemoRole): { email: string; password: string } {
  const creds = DEMO_CREDENTIALS[role];
  return {
    email: creds.email,
    password: creds.password,
  };
}
