import type { LastFmArtistTopTagsResponse, LastFmSimilarArtistsResponse, RetryConfig } from '@server/types';

import logger from '@server/config/logger';
import { BaseClient } from '@server/services/BaseClient';
import { LASTFM_BASE_URL } from '@server/constants/clients';

interface SimilarArtist {
  name:  string;
  match: number;  // Similarity score 0-1
  mbid?: string;
}

/**
 * LastFmClient provides access to Last.fm API for similar artist discovery.
 * https://www.last.fm/api
 */
export class LastFmClient extends BaseClient {
  private apiKey: string;

  constructor(apiKey: string, retryConfig?: Partial<RetryConfig>) {
    super(retryConfig);
    this.apiKey = apiKey;
  }

  /**
   * Get similar artists from Last.fm
   */
  async getSimilarArtists(artistName: string, limit: number = 10, signal?: AbortSignal): Promise<SimilarArtist[]> {
    try {
      const response = await this.requestWithRetry<LastFmSimilarArtistsResponse>('get', LASTFM_BASE_URL, {
        params: {
          method:  'artist.getsimilar',
          artist:  artistName,
          api_key: this.apiKey,
          limit,
          format:  'json',
        },
        timeout: 15000,
        signal,
      });

      const data = response.data;

      // Check for Last.fm error
      if (data.error) {
        logger.debug(`Last.fm error for '${ artistName }': ${ data.message || 'Unknown' }`);

        return [];
      }

      const similar: SimilarArtist[] = [];

      for (const artist of data.similarartists?.artist || []) {
        similar.push({
          name:  artist.name || '',
          match: parseFloat(artist.match || '0'),
          mbid:  artist.mbid || undefined,
        });
      }

      return similar;
    } catch(error) {
      logger.debug(`Failed to get similar artists for '${ artistName }': ${ error instanceof Error ? error.message : String(error) }`);

      return [];
    }
  }

  /**
   * Get top tags for an artist from Last.fm
   */
  async getArtistTopTags(artistName: string, limit: number = 10): Promise<{ name: string; count: number }[]> {
    try {
      const response = await this.requestWithRetry<LastFmArtistTopTagsResponse>('get', LASTFM_BASE_URL, {
        params: {
          method:  'artist.gettoptags',
          artist:  artistName,
          api_key: this.apiKey,
          format:  'json',
        },
        timeout: 15000,
      });

      const data = response.data;

      if (data.error) {
        logger.debug(`Last.fm error fetching tags for '${ artistName }': ${ data.message || 'Unknown' }`);

        return [];
      }

      return (data.toptags?.tag || [])
        .slice(0, limit)
        .map((tag) => ({ name: tag.name.toLowerCase(), count: tag.count }));
    } catch(error) {
      logger.debug(`Failed to get top tags for '${ artistName }': ${ error instanceof Error ? error.message : String(error) }`);

      return [];
    }
  }
}
