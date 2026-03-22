import { MAX_RETRIES, RETRY_DELAYS } from '@/constants/api';
import { ROUTE_PATHS } from '@/constants/routes';

interface HttpResponse<T = unknown> {
  data:   T;
  status: number;
}

interface RequestConfig {
  params?:       Record<string, string | number | boolean>;
  headers?:      Record<string, string>;
  data?:         unknown;
  responseType?: 'blob' | 'json';
}

let showErrorToast: ((message: string, detail?: string) => void) | null = null;

/**
 * Register the toast callback for showing errors from the API client.
 * Call this from App.vue after the toast is available.
 */
export function setToastCallback(callback: (message: string, detail?: string) => void): void {
  showErrorToast = callback;
}

const baseURL = import.meta.env.VITE_API_URL || '/api/v1';

let redirectingToLogin = false;

function getAuthMode(): string | null {
  return localStorage.getItem('auth_mode');
}

function buildURL(path: string, params?: Record<string, string | number | boolean>): string {
  const url = new URL(`${ baseURL }${ path }`, window.location.origin);

  if (params) {
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, String(value));
    }
  }

  return url.toString();
}

function buildAuthHeaders(): Record<string, string> {
  const authMode = getAuthMode();

  if (authMode === 'proxy' || authMode === 'disabled') {
    return {};
  }

  if (authMode === 'api_key') {
    const apiKey = localStorage.getItem('auth_api_key');

    return apiKey ? { Authorization: `Bearer ${ apiKey }` } : {};
  }

  const credentials = localStorage.getItem('auth_credentials');

  return credentials ? { Authorization: `Basic ${ credentials }` } : {};
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  config?: RequestConfig,
): Promise<HttpResponse<T>> {
  const url = buildURL(path, config?.params);

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...buildAuthHeaders(),
    ...config?.headers,
  };

  const init: RequestInit = { method, headers };

  if (body !== undefined) {
    init.body = JSON.stringify(body);
  } else if (config?.data !== undefined) {
    init.body = JSON.stringify(config.data);
  }

  return executeWithRetry<T>(url, init, config?.responseType ?? 'json');
}

async function executeWithRetry<T>(
  url: string,
  init: RequestInit,
  responseType: 'blob' | 'json',
  retryCount = 0,
): Promise<HttpResponse<T>> {
  const response = await fetch(url, init);

  // 401 -> redirect to login
  if (response.status === 401) {
    const authMode = getAuthMode();

    if (authMode !== 'proxy' && authMode !== 'disabled') {
      localStorage.removeItem('auth_credentials');
      localStorage.removeItem('auth_username');
      localStorage.removeItem('auth_api_key');

      if (!redirectingToLogin && window.location.pathname !== ROUTE_PATHS.LOGIN) {
        redirectingToLogin = true;
        window.location.replace(ROUTE_PATHS.LOGIN);
      }
    }

    throw new HttpClientError('Unauthorized', response.status);
  }

  // 503 database_busy -> retry
  if (response.status === 503) {
    const clone = response.clone();

    try {
      const errorData = await clone.json() as { code?: string };

      if (errorData?.code === 'database_busy' && retryCount < MAX_RETRIES) {
        const delay = RETRY_DELAYS[retryCount] ?? RETRY_DELAYS[RETRY_DELAYS.length - 1] ?? 1000;

        await sleep(delay);

        return executeWithRetry<T>(url, init, responseType, retryCount + 1);
      }

      if (errorData?.code === 'database_busy' && showErrorToast) {
        showErrorToast('Database Busy', `The database is busy after ${ MAX_RETRIES } retries. Please try again later.`);
      }
    } catch {
      // Not JSON: fall through to generic error
    }

    throw new HttpClientError('Service Unavailable', response.status);
  }

  if (!response.ok) {
    throw new HttpClientError(`HTTP ${ response.status }`, response.status);
  }

  const data = responseType === 'blob'? await response.blob() as T: await response.json() as T;

  return { data, status: response.status };
}

class HttpClientError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'HttpClientError';
    this.status = status;
  }
}

const client = {
  get<T = unknown>(url: string, config?: RequestConfig): Promise<HttpResponse<T>> {
    return request<T>('GET', url, undefined, config);
  },

  post<T = unknown>(url: string, body?: unknown, config?: RequestConfig): Promise<HttpResponse<T>> {
    return request<T>('POST', url, body, config);
  },

  put<T = unknown>(url: string, body?: unknown, config?: RequestConfig): Promise<HttpResponse<T>> {
    return request<T>('PUT', url, body, config);
  },

  delete<T = unknown>(url: string, config?: RequestConfig): Promise<HttpResponse<T>> {
    return request<T>('DELETE', url, undefined, config);
  },
};

export default client;
