import { HttpError } from './HttpError';

export interface RequestOptions {
  method?:  'GET' | 'POST' | 'PUT' | 'DELETE';
  headers?: Record<string, string>;
  params?:  Record<string, string | number | boolean>;
  body?:    unknown;
  timeout?: number;
  signal?:  AbortSignal;
}

export interface HttpResponse<T> {
  data:   T;
  status: number;
}

function buildUrl(url: string, params?: Record<string, string | number | boolean>): string {
  const urlObj = new URL(url);

  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null) {
        urlObj.searchParams.set(key, String(value));
      }
    }
  }

  return urlObj.toString();
}

function buildSignal(timeout?: number, signal?: AbortSignal): AbortSignal | undefined {
  if (timeout && signal) {
    return AbortSignal.any([signal, AbortSignal.timeout(timeout)]);
  }

  if (timeout) {
    return AbortSignal.timeout(timeout);
  }

  return signal;
}

/**
 * fetch wrapper that throws HttpError on non-2xx responses.
 */
async function fetchRaw(url: string, options: RequestOptions = {}): Promise<Response> {
  const {
    method = 'GET', headers = {}, params, body, timeout, signal
  } = options;

  const requestUrl = buildUrl(url, params);

  const requestHeaders: Record<string, string> = { ...headers };
  let requestBody: string | undefined;

  if (body !== undefined) {
    if (typeof body === 'string') {
      requestBody = body;
    } else {
      requestBody = JSON.stringify(body);
      requestHeaders['Content-Type'] ??= 'application/json';
    }
  }

  const response = await fetch(requestUrl, {
    method,
    headers: requestHeaders,
    body:    requestBody,
    signal:  buildSignal(timeout, signal),
  });

  if (!response.ok) {
    let data: unknown;
    const text = await response.text();

    try {
      data = JSON.parse(text);
    } catch {
      data = text || undefined;
    }

    throw new HttpError(
      `HTTP ${ response.status }: ${ response.statusText }`,
      response.status,
      data,
    );
  }

  return response;
}

/**
 * Fetch JSON from a URL. Throws HttpError on non-2xx responses.
 */
export async function fetchJson<T>(url: string, options: RequestOptions = {}): Promise<HttpResponse<T>> {
  const response = await fetchRaw(url, options);

  let data: T;

  try {
    data = await response.json() as T;
  } catch {
    data = undefined as T;
  }

  return { data, status: response.status };
}
