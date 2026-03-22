import type { AuthConfig, AuthUser } from '@/types';

const baseURL = import.meta.env.VITE_API_URL || '/api/v1';

/**
 * Fetch auth configuration from server (public endpoint)
 */
export async function fetchAuthConfig(): Promise<AuthConfig> {
  const response = await fetch(`${ baseURL }/auth/info`);

  if (!response.ok) {
    throw new Error(`Failed to fetch auth config: ${ response.status }`);
  }

  return response.json() as Promise<AuthConfig>;
}

/**
 * Fetch current user info (requires auth)
 * Uses provided credentials/headers for authentication
 */
export async function fetchCurrentUser(headers?: Record<string, string>): Promise<AuthUser> {
  const response = await fetch(`${ baseURL }/auth/me`, { headers });

  if (!response.ok) {
    throw new Error(`Failed to fetch current user: ${ response.status }`);
  }

  return response.json() as Promise<AuthUser>;
}
