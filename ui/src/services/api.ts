import type { AxiosError, InternalAxiosRequestConfig } from 'axios';

import axios from 'axios';

import { MAX_RETRIES, RETRY_DELAYS } from '@/constants/api';
import { ROUTE_PATHS } from '@/constants/routes';

let redirectingToLogin = false;

/**
 * Toast callback for showing error messages from outside Vue components.
 * Set by calling setToastCallback from App.vue.
 */
let showErrorToast: ((message: string, detail?: string) => void) | null = null;

/**
 * Register the toast callback for showing errors from the API client.
 * Call this from App.vue after the toast is available.
 */
export function setToastCallback(callback: (message: string, detail?: string) => void): void {
  showErrorToast = callback;
}

interface RetryConfig extends InternalAxiosRequestConfig {
  _retryCount?: number;
}

function isDatabaseBusyError(error: AxiosError): boolean {
  if (error.response?.status !== 503) {
    return false;
  }

  const data = error.response.data as { code?: string } | undefined;

  return data?.code === 'database_busy';
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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

client.interceptors.request.use((config) => {
  const authMode = getAuthMode();

  // For proxy/disabled modes, don't add any auth headers
  if (authMode === 'proxy' || authMode === 'disabled') {
    return config;
  }

  if (authMode === 'api_key') {
    const apiKey = localStorage.getItem('auth_api_key');

    if (apiKey) {
      config.headers.Authorization = `Bearer ${ apiKey }`;
    }

    return config;
  }

  const credentials = localStorage.getItem('auth_credentials');

  if (credentials) {
    config.headers.Authorization = `Basic ${ credentials }`;
  }

  return config;
});

// Response interceptor to handle 401 (redirect to login) and 503 (database busy with retry)
client.interceptors.response.use(
  (response) => response,
  async(error: AxiosError) => {
    const config = error.config as RetryConfig | undefined;

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

      return Promise.reject(error);
    }

    if (isDatabaseBusyError(error) && config) {
      const retryCount = config._retryCount || 0;

      if (retryCount < MAX_RETRIES) {
        config._retryCount = retryCount + 1;
        const delay = RETRY_DELAYS[retryCount] ?? RETRY_DELAYS[RETRY_DELAYS.length - 1] ?? 1000;

        await sleep(delay);

        return client.request(config);
      }

      if (showErrorToast) {
        showErrorToast('Database Busy', `The database is busy after ${ MAX_RETRIES } retries. Please try again later.`);
      }
    }

    return Promise.reject(error);
  }
);

export default client;
