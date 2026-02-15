import type { AxiosRequestConfig, AxiosResponse } from 'axios';

import axios from 'axios';

import logger from '@server/config/logger';
import { isTransientError } from '@server/utils/errorHandler';
import { DEFAULT_MAX_RETRIES, DEFAULT_BASE_DELAY_MS } from '@server/constants/services';

interface RetryConfig {
  maxRetries:  number;
  baseDelayMs: number;
}

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
    config?: AxiosRequestConfig,
    data?: unknown
  ): Promise<AxiosResponse<T>> {
    const { maxRetries, baseDelayMs } = this.retryConfig;
    let lastError: unknown;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        if (method === 'post') {
          return await axios.post<T>(url, data, config);
        }

        return await axios.get<T>(url, config);
      } catch(error) {
        lastError = error;

        if (!isTransientError(error) || attempt === maxRetries) {
          throw error;
        }

        // Add a random offset so retries don't synchronize
        const delay = (baseDelayMs * Math.pow(2, attempt - 1)) + (Math.random() * 100);

        logger.warn(`Network error for ${ url } [${ attempt }/${ maxRetries } retrying in ${ Math.round(delay) }ms]: ${ (error as Error).message }`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    throw lastError;
  }
}
