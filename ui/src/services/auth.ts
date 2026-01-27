import type { AuthConfig, AuthUser } from '@/types/auth';

import axios from 'axios';

// Use raw axios instance without interceptors for public endpoint
const baseURL = import.meta.env.VITE_API_URL || '/api/v1';

/**
 * Fetch auth configuration from server (public endpoint)
 */
export async function fetchAuthConfig(): Promise<AuthConfig> {
  const response = await axios.get<AuthConfig>(`${ baseURL }/auth/info`);

  return response.data;
}

/**
 * Fetch current user info (requires auth)
 * Uses provided credentials/headers for authentication
 */
export async function fetchCurrentUser(headers?: Record<string, string>): Promise<AuthUser> {
  const response = await axios.get<AuthUser>(`${ baseURL }/auth/me`, { headers });

  return response.data;
}
