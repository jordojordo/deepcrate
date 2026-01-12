import axios from 'axios';
import logger from '@server/config/logger';

const BASE_URL = 'https://ws.audioscrobbler.com/2.0/';

export interface SimilarArtist {
  name:  string;
  match: number;  // Similarity score 0-1
  mbid?: string;
}

/**
 * LastFmClient provides access to Last.fm API for similar artist discovery.
 * https://www.last.fm/api
 */
export class LastFmClient {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  /**
   * Get similar artists from Last.fm
   */
  async getSimilarArtists(artistName: string, limit: number = 10): Promise<SimilarArtist[]> {
    try {
      const response = await axios.get(BASE_URL, {
        params: {
          method:  'artist.getsimilar',
          artist:  artistName,
          api_key: this.apiKey,
          limit,
          format:  'json',
        },
        timeout: 15000,
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
      if (axios.isAxiosError(error)) {
        logger.debug(`Failed to get similar artists for '${ artistName }': ${ error.message }`);
      } else {
        logger.debug(`Failed to get similar artists for '${ artistName }': ${ String(error) }`);
      }

      return [];
    }
  }
}

export default LastFmClient;
