import type { RetryConfig } from '@server/types/clients';
import type { RequestOptions, HttpResponse } from '@server/utils/httpClient';

import logger from '@server/config/logger';
import { HttpError } from '@server/utils/HttpError';
import { isGlobalLoadShed, isTransientError } from '@server/utils/errorHandler';
import { fetchJson } from '@server/utils/httpClient';
import { blockHost, retryAfterMs } from '@server/utils/rateLimiter';
import { DEFAULT_MAX_RETRIES, DEFAULT_BASE_DELAY_MS } from '@server/constants/services';

export class BaseClient {
  private retryConfig: RetryConfig;

  constructor(retryConfig?: Partial<RetryConfig>) {
    this.retryConfig = {
      maxRetries:  retryConfig?.maxRetries ?? DEFAULT_MAX_RETRIES,
      baseDelayMs: retryConfig?.baseDelayMs ?? DEFAULT_BASE_DELAY_MS,
    };
  }

  public async requestWithRetry<T>(
    method: 'get' | 'post',
    url: string,
    config?: RequestOptions,
    data?: unknown
  ): Promise<HttpResponse<T>> {
    const { maxRetries, baseDelayMs } = this.retryConfig;
    let lastError: unknown;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      // Bail immediately if the caller already aborted
      if (config?.signal?.aborted) {
        throw new DOMException('Request aborted', 'AbortError');
      }

      try {
        const options: RequestOptions = {
          ...config,
          method: method === 'post' ? 'POST' : 'GET',
        };

        if (method === 'post' && data !== undefined) {
          options.body = data;
        }

        return await fetchJson<T>(url, options);
      } catch(error) {
        lastError = error;

        if (!isTransientError(error)) {
          throw error;
        }

        // Add a randomish offset so retries don't synchronize
        const backoff = baseDelayMs * Math.pow(2, attempt - 1);
        const delay = (backoff / 2) + (Math.random() * backoff / 2);

        const hostWait = this.backOffHost(url, error, delay);

        if (attempt === maxRetries) {
          throw error;
        }

        logger.debug(`${ this.describeRetryReason(error, hostWait) } for ${ url } [${ attempt }/${ maxRetries } retrying in ${ Math.round(Math.max(delay, hostWait)) }ms]: ${ (error as Error).message }`);

        await this.abortableSleep(delay, config?.signal as AbortSignal);
      }
    }

    throw lastError;
  }

  /**
   * When the upstream asks for a backoff, pause every request to the host
   * rather than just this one. Returns the imposed wait in ms (0 if none).
   *
   * A 429 that doesn't say how long to wait falls back to our own backoff.
   * MusicBrainz load-shedding sends `Retry-After: 0`, so it blocks nothing.
   */
  private backOffHost(url: string, error: unknown, fallbackMs: number): number {
    if (!(error instanceof HttpError)) {
      return 0;
    }

    const requested = retryAfterMs(error.headers) ?? (error.status === 429 ? fallbackMs : 0);

    if (requested > 0) {
      blockHost(url, requested);
    }

    return requested;
  }

  private describeRetryReason(error: unknown, hostWait: number): string {
    if (isGlobalLoadShed(error)) {
      return 'Upstream shedding load (zone: global)';
    }

    if (error instanceof HttpError) {
      return error.status === 429 || hostWait > 0 ? 'Rate limited' : 'Retryable HTTP error';
    }

    return 'Network error';
  }

  /**
  * Sleep that rejects immediately when an AbortSignal fires.
  */
  private abortableSleep(ms: number, signal?: AbortSignal | undefined): Promise<void> {
    if (!signal) {
      return new Promise((resolve) => setTimeout(resolve, ms));
    }

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        signal.removeEventListener('abort', onAbort);
        resolve();
      }, ms);

      const onAbort = () => {
        clearTimeout(timer);
        reject(new DOMException('Request aborted', 'AbortError'));
      };

      if (signal.aborted) {
        clearTimeout(timer);
        reject(new DOMException('Request aborted', 'AbortError'));

        return;
      }

      signal.addEventListener('abort', onAbort, { once: true });
    });
  }
}
