import type { RetryConfig } from '@server/types/clients';
import type { RequestOptions, HttpResponse } from '@server/utils/httpClient';

import logger from '@server/config/logger';
import { isTransientError } from '@server/utils/errorHandler';
import { fetchJson } from '@server/utils/httpClient';
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

        if (!isTransientError(error) || attempt === maxRetries) {
          throw error;
        }

        // Add a random offset so retries don't synchronize
        const delay = (baseDelayMs * Math.pow(2, attempt - 1)) + (Math.random() * 100);

        logger.warn(`Network error for ${ url } [${ attempt }/${ maxRetries } retrying in ${ Math.round(delay) }ms]: ${ (error as Error).message }`);
        await this.abortableSleep(delay, config?.signal as AbortSignal);
      }
    }

    throw lastError;
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
