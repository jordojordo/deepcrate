import axios, { AxiosInstance } from 'axios';
import logger from '@server/config/logger';

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

export interface SlskdTransferFile {
  id:               string;
  filename:         string;
  size:             number;
  state:            'Queued' | 'Initializing' | 'InProgress' | 'Completed' | 'Errored' | 'Cancelled' | 'TimedOut';
  bytesTransferred: number;
  averageSpeed?:    number;
  remainingTime?:   number;
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

/**
 * SlskdClient provides access to slskd (Soulseek) API for music downloads.
 * https://github.com/slskd/slskd
 */
export class SlskdClient {
  private client: AxiosInstance;

  constructor(host: string, apiKey: string) {
    this.client = axios.create({
      baseURL: host.replace(/\/$/, ''),
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
        logger.error(`slskd search failed: ${ error.message }`);
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
   * Enqueue files for download
   */
  async enqueue(username: string, files: SlskdFile[]): Promise<boolean> {
    try {
      await this.client.post(`/api/v0/transfers/downloads/${ encodeURIComponent(username) }`, files.map(file => ({
        filename: file.filename,
        size:     file.size ?? 0,
      })));

      logger.info(`Enqueued ${ files.length } files from ${ username }`);

      return true;
    } catch(error) {
      if (axios.isAxiosError(error)) {
        logger.error(`Failed to enqueue downloads: ${ error.message }`);
      } else {
        logger.error(`Failed to enqueue downloads: ${ String(error) }`);
      }

      return false;
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
        logger.error(`Failed to get downloads: ${ error.message }`);
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
