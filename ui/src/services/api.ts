import axios from 'axios';
import { ROUTE_PATHS } from '@/constants/routes';

let redirectingToLogin = false;

const client = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api/v1',
  headers: { 'Content-Type': 'application/json' },
});

/**
 * Get the current auth mode from localStorage cache
 * This avoids circular dependency with the store
 */
function getAuthMode(): string | null {
  return localStorage.getItem('auth_mode');
}

// Request interceptor to add auth headers based on mode
client.interceptors.request.use((config) => {
  const authMode = getAuthMode();

  // For proxy/disabled modes, don't add any auth headers
  if (authMode === 'proxy' || authMode === 'disabled') {
    return config;
  }

  // For API key mode, use Bearer token
  if (authMode === 'api_key') {
    const apiKey = localStorage.getItem('auth_api_key');

    if (apiKey) {
      config.headers.Authorization = `Bearer ${ apiKey }`;
    }

    return config;
  }

  // Default: Basic auth mode
  const credentials = localStorage.getItem('auth_credentials');

  if (credentials) {
    config.headers.Authorization = `Basic ${ credentials }`;
  }

  return config;
});

// Response interceptor to handle 401 (redirect to login)
client.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      const authMode = getAuthMode();

      // Only redirect to login for modes that require it
      if (authMode !== 'proxy' && authMode !== 'disabled') {
        localStorage.removeItem('auth_credentials');
        localStorage.removeItem('auth_username');
        localStorage.removeItem('auth_api_key');

        if (!redirectingToLogin && window.location.pathname !== ROUTE_PATHS.LOGIN) {
          redirectingToLogin = true;
          window.location.replace(ROUTE_PATHS.LOGIN);
        }
      }
    }

    return Promise.reject(error);
  }
);

export default client;
