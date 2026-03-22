import type {
  SlskdFile,
  SlskdSearchResponse,
  SlskdSearchState,
  SlskdUserTransfers,
  SlskdEnqueueResult,
} from '@server/types/slskd-client';

import logger from '@server/config/logger';
import { HttpError } from '@server/utils/HttpError';
import { fetchJson } from '@server/utils/httpClient';

/**
 * Custom error class for slskd API errors that should be surfaced to callers.
 * Auth errors (401/403) are non-retryable and indicate configuration issues.
 */
class SlskdError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number, // eslint-disable-line no-unused-vars
    public readonly code?: string, // eslint-disable-line no-unused-vars
    public readonly isAuthError: boolean = false // eslint-disable-line no-unused-vars

  ) {
    super(message);
    this.name = 'SlskdError';
  }

  static fromHttpError(error: HttpError, context: string): SlskdError {
    const status = error.status;
    const code = error.code;
    const isAuthError = status === 401 || status === 403;
    const detail = error.message
      || (status ? `HTTP ${ status }` : null)
      || (code ? `code ${ code }` : null)
      || 'unknown error';

    let message;

    if (isAuthError) {
      message = `${ context }: Authentication failed (status ${ status }) - check slskd API key`;
    } else {
      message = `${ context }: ${ detail }`;
    }

    return new SlskdError(message, status, code, isAuthError);
  }
}

/**
 * SlskdClient provides access to slskd (Soulseek) API for music downloads.
 * https://github.com/slskd/slskd
 */
export class SlskdClient {
  private baseURL:        string;
  private defaultHeaders: Record<string, string>;
  private timeout:        number;

  constructor(host: string, apiKey: string, urlBase: string = '/') {
    const trimmedHost = host.replace(/\/$/, '');
    const trimmedBase = urlBase.trim();
    const normalizedBase =
      trimmedBase === '' || trimmedBase === '/'? '': `/${ trimmedBase.replace(/^\/+|\/+$/g, '') }`;

    this.baseURL = `${ trimmedHost }${ normalizedBase }`;
    this.defaultHeaders = { 'X-API-Key': apiKey };
    this.timeout = 30000;
  }

  private async request<T>(path: string, options: { method?: 'GET' | 'POST' | 'DELETE'; body?: unknown; params?: Record<string, string | number | boolean> } = {}) {
    return fetchJson<T>(`${ this.baseURL }${ path }`, {
      method:  options.method ?? 'GET',
      headers: { ...this.defaultHeaders },
      timeout: this.timeout,
      body:    options.body,
      params:  options.params,
    });
  }

  /**
   * Start a text search
   */
  async search(query: string, timeout: number = 15000, minFiles: number = 3): Promise<string | null> {
    try {
      const response = await this.request('/api/v0/searches', {
        method: 'POST',
        body:   {
          searchText:               query,
          searchTimeout:            timeout,
          filterResponses:          true,
          minimumResponseFileCount: minFiles,
        },
      });

      const searchId = (response.data as Record<string, unknown>)?.id as string | undefined;

      if (!searchId) {
        logger.error('No search ID returned from slskd');

        return null;
      }

      return searchId;
    } catch(error) {
      if (error instanceof HttpError) {
        const slskdError = SlskdError.fromHttpError(error, 'slskd search failed');

        logger.error(slskdError.message);

        // Throw auth errors so callers can surface them properly
        if (slskdError.isAuthError) {
          throw slskdError;
        }
      } else {
        logger.error(`slskd search failed: ${ String(error) }`);
      }

      return null;
    }
  }

  /**
   * Get search state
   */
  async getSearchState(searchId: string): Promise<SlskdSearchState | null> {
    const normalizeState = (value: unknown): SlskdSearchState['state'] | null => {
      if (typeof value !== 'string') {
        return null;
      }

      // slskd sometimes returns a flags enum string like "Completed, TimedOut"
      const flags = value
        .split(',')
        .map((part) => part.trim().toLowerCase())
        .filter(Boolean);

      if (flags.includes('cancelled') || flags.includes('canceled')) {
        return 'Cancelled';
      }

      if (flags.includes('completed') || flags.includes('timedout') || flags.includes('timed out')) {
        // Treat "TimedOut" as completed so we can still fetch whatever responses exist.
        return 'Completed';
      }

      if (flags.includes('inprogress') || flags.includes('in progress')) {
        return 'InProgress';
      }

      return null;
    };

    const encodedSearchId = encodeURIComponent(searchId);
    // Multiple endpoint candidates handle different slskd API versions:
    // - /searches/{id} returns full search object (older versions)
    // - /searches/{id}/state returns state directly (some versions)
    // - /searches/{id}/status returns status object (other versions)
    const candidates = [
      `/api/v0/searches/${ encodedSearchId }`,
      `/api/v0/searches/${ encodedSearchId }/state`,
      `/api/v0/searches/${ encodedSearchId }/status`,
    ];

    for (const endpoint of candidates) {
      try {
        const response = await this.request(endpoint);
        const data = response.data as unknown;

        if (typeof data === 'string') {
          const normalized = normalizeState(data);

          if (normalized) {
            return { state: normalized };
          }

          logger.debug(`Unexpected search state string from ${ endpoint }: ${ data }`);

          return null;
        }

        if (data && typeof data === 'object') {
          const stateValue = (data as { state?: unknown; searchState?: unknown }).state
            ?? (data as { searchState?: unknown }).searchState;

          const normalized = normalizeState(stateValue);

          if (normalized) {
            return { state: normalized };
          }

          const isComplete = (data as { isComplete?: unknown }).isComplete;

          if (isComplete === true) {
            return { state: 'Completed' };
          }
        }

        logger.debug(`Unexpected search state response from ${ endpoint }: ${ JSON.stringify(data) }`);

        return null;
      } catch(error) {
        if (error instanceof HttpError) {
          if (error.status === 404) {
            continue;
          }

          logger.error(`Failed to get search state (${ endpoint }): ${ error.message }`);
        } else {
          logger.error(`Failed to get search state (${ endpoint }): ${ String(error) }`);
        }

        return null;
      }
    }

    logger.error(`Failed to get search state: no matching endpoint for search ${ searchId }`);

    return null;
  }

  /**
   * Get search responses
   */
  async getSearchResponses(searchId: string): Promise<SlskdSearchResponse[]> {
    try {
      const response = await this.request(`/api/v0/searches/${ encodeURIComponent(searchId) }/responses`);

      return (response.data || []) as SlskdSearchResponse[];
    } catch(error) {
      logger.error(`Failed to get search responses: ${ error instanceof Error ? error.message : String(error) }`);

      return [];
    }
  }

  /**
   * Delete a search
   */
  async deleteSearch(searchId: string): Promise<void> {
    try {
      await this.request(`/api/v0/searches/${ encodeURIComponent(searchId) }`, { method: 'DELETE' });
    } catch(error) {
      // Ignore errors when cleaning up searches
      logger.debug(`Failed to delete search ${ searchId }: ${ String(error) }`);
    }
  }

  /**
   * Enqueue files for download.
   * Returns the enqueue result with counts, or null on failure.
   */
  async enqueue(username: string, files: SlskdFile[]): Promise<SlskdEnqueueResult | null> {
    try {
      const response = await this.request<SlskdEnqueueResult>(
        `/api/v0/transfers/downloads/${ encodeURIComponent(username) }`,
        {
          method: 'POST',
          body:   files.map(file => ({
            filename: file.filename,
            size:     file.size ?? 0,
          })),
        }
      );

      const enqueued = response.data.enqueued ?? [];
      const failed = response.data.failed ?? [];

      logger.info(`Enqueued ${ enqueued.length } files from ${ username } (${ failed.length } failed)`);

      return { enqueued, failed };
    } catch(error) {
      if (error instanceof HttpError) {
        const slskdError = SlskdError.fromHttpError(error, 'Failed to enqueue downloads');

        logger.error(slskdError.message);

        if (slskdError.isAuthError) {
          throw slskdError;
        }
      } else {
        logger.error(`Failed to enqueue downloads: ${ String(error) }`);
      }

      return null;
    }
  }

  /**
   * Get all active downloads
   */
  async getDownloads(): Promise<SlskdUserTransfers[]> {
    try {
      const response = await this.request('/api/v0/transfers/downloads');

      return (response.data || []) as SlskdUserTransfers[];
    } catch(error) {
      if (error instanceof HttpError) {
        const slskdError = SlskdError.fromHttpError(error, 'Failed to get downloads');

        logger.error(slskdError.message);

        if (slskdError.isAuthError) {
          throw slskdError;
        }
      } else {
        logger.error(`Failed to get downloads: ${ String(error) }`);
      }

      return [];
    }
  }

  /**
   * Get downloads from a specific user
   */
  async getUserDownloads(username: string): Promise<SlskdUserTransfers | null> {
    try {
      const response = await this.request(`/api/v0/transfers/downloads/${ encodeURIComponent(username) }`);

      return response.data as SlskdUserTransfers;
    } catch(error) {
      logger.error(`Failed to get downloads for user ${ username }: ${ error instanceof Error ? error.message : String(error) }`);

      return null;
    }
  }

  /**
   * Cancel and optionally remove a download.
   * @param username - The username of the peer
   * @param fileId - The transfer file ID
   * @param remove - If true, removes the record from slskd entirely (default: true)
   */
  async cancelDownload(username: string, fileId: string, remove: boolean = true): Promise<boolean> {
    try {
      await this.request(
        `/api/v0/transfers/downloads/${ encodeURIComponent(username) }/${ encodeURIComponent(fileId) }`,
        {
          method: 'DELETE',
          params: { remove },
        }
      );

      logger.info(`Cancelled download: ${ username }/${ fileId } (remove=${ remove })`);

      return true;
    } catch(error) {
      logger.error(`Failed to cancel download: ${ error instanceof Error ? error.message : String(error) }`);

      return false;
    }
  }
}
