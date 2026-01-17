import axios, { AxiosInstance, AxiosError } from 'axios';
import logger from '@server/config/logger';

/**
 * Custom error class for slskd API errors that should be surfaced to callers.
 * Auth errors (401/403) are non-retryable and indicate configuration issues.
 */
export class SlskdError extends Error {
  constructor(
    message: string,
    // eslint-disable-next-line no-unused-vars
    public readonly statusCode?: number,
    // eslint-disable-next-line no-unused-vars
    public readonly isAuthError: boolean = false
  ) {
    super(message);
    this.name = 'SlskdError';
  }

  static fromAxiosError(error: AxiosError, context: string): SlskdError {
    const status = error.response?.status;
    const isAuthError = status === 401 || status === 403;
    const message = isAuthError ? `${ context }: Authentication failed (status ${ status }) - check slskd API key` : `${ context }: ${ error.message }`;

    return new SlskdError(message, status, isAuthError);
  }
}

export interface SlskdSearchResponse {
  username:           string;
  files:              SlskdFile[];
  hasFreeUploadSlot?: boolean;
  uploadSpeed?:       number;
}

export interface SlskdFile {
  filename: string;
  size?:    number;
}

export interface SlskdSearchResult {
  id: string;
}

export interface SlskdSearchState {
  state: 'InProgress' | 'Completed' | 'Cancelled';
}

/**
 * Transfer file from slskd downloads API.
 * The `state` field is a comma-separated flags string (e.g., "Completed, Succeeded")
 * rather than a single enum value.
 */
export interface SlskdTransferFile {
  id:               string;
  username:         string;
  direction:        'Download' | 'Upload';
  filename:         string;
  size:             number;
  startOffset:      number;
  state:            string;  // Flags string like "Completed, Succeeded"
  stateDescription: string;
  requestedAt:      string;  // ISO date
  enqueuedAt:       string;  // ISO date
  startedAt?:       string;  // ISO date
  endedAt?:         string;  // ISO date
  bytesTransferred: number;
  averageSpeed:     number;
  bytesRemaining:   number;
  elapsedTime:      string;  // TimeSpan format "00:00:09.9020424"
  percentComplete:  number;  // 0-100
  remainingTime:    string;  // TimeSpan format
}

export interface SlskdTransferDirectory {
  directory: string;
  fileCount: number;
  files:     SlskdTransferFile[];
}

export interface SlskdUserTransfers {
  username:    string;
  directories: SlskdTransferDirectory[];
}

export interface SlskdEnqueueResult {
  enqueued: SlskdTransferFile[];
  failed:   SlskdTransferFile[];
}

/**
 * SlskdClient provides access to slskd (Soulseek) API for music downloads.
 * https://github.com/slskd/slskd
 */
export class SlskdClient {
  private client: AxiosInstance;

  constructor(host: string, apiKey: string, urlBase: string = '/') {
    const trimmedHost = host.replace(/\/$/, '');
    const trimmedBase = urlBase.trim();
    const normalizedBase =
      trimmedBase === '' || trimmedBase === '/'? '': `/${ trimmedBase.replace(/^\/+|\/+$/g, '') }`;

    this.client = axios.create({
      baseURL: `${ trimmedHost }${ normalizedBase }`,
      headers: { 'X-API-Key': apiKey },
      timeout: 30000,
    });
  }

  /**
   * Start a text search
   */
  async search(query: string, timeout: number = 15000, minFiles: number = 3): Promise<string | null> {
    try {
      const response = await this.client.post('/api/v0/searches', {
        searchText:               query,
        searchTimeout:            timeout,
        filterResponses:          true,
        minimumResponseFileCount: minFiles,
      });

      const searchId = response.data?.id;

      if (!searchId) {
        logger.error('No search ID returned from slskd');

        return null;
      }

      return searchId;
    } catch(error) {
      if (axios.isAxiosError(error)) {
        const slskdError = SlskdError.fromAxiosError(error, 'slskd search failed');

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
        const response = await this.client.get(endpoint);
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
        if (axios.isAxiosError(error)) {
          if (error.response?.status === 404) {
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
      const response = await this.client.get(`/api/v0/searches/${ encodeURIComponent(searchId) }/responses`);

      return response.data || [];
    } catch(error) {
      if (axios.isAxiosError(error)) {
        logger.error(`Failed to get search responses: ${ error.message }`);
      } else {
        logger.error(`Failed to get search responses: ${ String(error) }`);
      }

      return [];
    }
  }

  /**
   * Delete a search
   */
  async deleteSearch(searchId: string): Promise<void> {
    try {
      await this.client.delete(`/api/v0/searches/${ encodeURIComponent(searchId) }`);
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
      const response = await this.client.post<SlskdEnqueueResult>(
        `/api/v0/transfers/downloads/${ encodeURIComponent(username) }`,
        files.map(file => ({
          filename: file.filename,
          size:     file.size ?? 0,
        }))
      );

      const enqueued = response.data.enqueued ?? [];
      const failed = response.data.failed ?? [];

      logger.info(`Enqueued ${ enqueued.length } files from ${ username } (${ failed.length } failed)`);

      return { enqueued, failed };
    } catch(error) {
      if (axios.isAxiosError(error)) {
        const slskdError = SlskdError.fromAxiosError(error, 'Failed to enqueue downloads');

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
      const response = await this.client.get('/api/v0/transfers/downloads');

      return response.data || [];
    } catch(error) {
      if (axios.isAxiosError(error)) {
        const slskdError = SlskdError.fromAxiosError(error, 'Failed to get downloads');

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
      const response = await this.client.get(`/api/v0/transfers/downloads/${ encodeURIComponent(username) }`);

      return response.data as SlskdUserTransfers;
    } catch(error) {
      if (axios.isAxiosError(error)) {
        logger.error(`Failed to get downloads for user ${ username }: ${ error.message }`);
      } else {
        logger.error(`Failed to get downloads for user ${ username }: ${ String(error) }`);
      }

      return null;
    }
  }

  /**
   * Cancel a download
   */
  async cancelDownload(username: string, fileId: string): Promise<boolean> {
    try {
      await this.client.delete(`/api/v0/transfers/downloads/${ encodeURIComponent(username) }/${ encodeURIComponent(fileId) }`);

      logger.info(`Cancelled download: ${ username }/${ fileId }`);

      return true;
    } catch(error) {
      if (axios.isAxiosError(error)) {
        logger.error(`Failed to cancel download: ${ error.message }`);
      } else {
        logger.error(`Failed to cancel download: ${ String(error) }`);
      }

      return false;
    }
  }
}

export default SlskdClient;
