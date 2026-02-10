import axios from 'axios';
import logger from '@server/config/logger';
import type {
  DeezerSearchResponse,
  DeezerSearchResult,
  DeezerAlbumSearchResponse,
  DeezerAlbumTracksResponse,
} from '@server/types/preview';

const BASE_URL = 'https://api.deezer.com';

/**
 * DeezerClient provides access to Deezer API for track preview URLs.
 * No API key required for search endpoint.
 * https://developers.deezer.com/api
 */
export class DeezerClient {
  /**
   * Search for a track and get its preview URL
   */
  async searchTrack(artist: string, track: string): Promise<string | null> {
    try {
      // Try exact search first
      const exactQuery = `artist:"${ artist }" track:"${ track }"`;
      let result = await this.search(exactQuery);

      if (result) {
        return result.preview;
      }

      // Fallback to looser search
      const looseQuery = `${ artist } ${ track }`;

      result = await this.search(looseQuery);

      if (result) {
        return result.preview;
      }

      return null;
    } catch(error) {
      if (axios.isAxiosError(error)) {
        logger.debug(`Deezer search failed for '${ artist } - ${ track }': ${ error.message }`);
      } else {
        logger.debug(`Deezer search failed for '${ artist } - ${ track }': ${ String(error) }`);
      }

      return null;
    }
  }

  /**
   * Execute search query against Deezer API
   */
  private async search(query: string): Promise<DeezerSearchResult | null> {
    const response = await axios.get<DeezerSearchResponse>(`${ BASE_URL }/search`, {
      params:  { q: query },
      timeout: 10000,
    });

    const { data } = response.data;

    if (!data || data.length === 0) {
      return null;
    }

    // Return first result with a preview URL
    const resultWithPreview = data.find((item) => item.preview && item.preview.length > 0);

    return resultWithPreview || null;
  }

  /**
   * Search for an album and return its Deezer ID
   */
  async searchAlbum(artist: string, album: string): Promise<number | null> {
    try {
      // Try exact search first
      const exactQuery = `artist:"${ artist }" album:"${ album }"`;
      const response = await axios.get<DeezerAlbumSearchResponse>(`${ BASE_URL }/search/album`, {
        params:  { q: exactQuery },
        timeout: 10000,
      });

      const { data } = response.data;

      if (data && data.length > 0) {
        return data[0].id;
      }

      // Fallback to looser search
      const looseQuery = `${ artist } ${ album }`;
      const looseResponse = await axios.get<DeezerAlbumSearchResponse>(`${ BASE_URL }/search/album`, {
        params:  { q: looseQuery },
        timeout: 10000,
      });

      const looseData = looseResponse.data.data;

      if (looseData && looseData.length > 0) {
        return looseData[0].id;
      }

      return null;
    } catch(error) {
      if (axios.isAxiosError(error)) {
        logger.debug(`Deezer album search failed for '${ artist } - ${ album }': ${ error.message }`);
      } else {
        logger.debug(`Deezer album search failed for '${ artist } - ${ album }': ${ String(error) }`);
      }

      return null;
    }
  }

  /**
   * Get album track count from search results (no additional API call needed)
   */
  async getAlbumTrackCount(artist: string, album: string): Promise<number | null> {
    try {
      const exactQuery = `artist:"${ artist }" album:"${ album }"`;
      const response = await axios.get<DeezerAlbumSearchResponse>(`${ BASE_URL }/search/album`, {
        params:  { q: exactQuery },
        timeout: 10000,
      });

      const { data } = response.data;

      if (data && data.length > 0 && data[0].nb_tracks > 0) {
        return data[0].nb_tracks;
      }

      // Fallback to looser search
      const looseQuery = `${ artist } ${ album }`;
      const looseResponse = await axios.get<DeezerAlbumSearchResponse>(`${ BASE_URL }/search/album`, {
        params:  { q: looseQuery },
        timeout: 10000,
      });

      const looseData = looseResponse.data.data;

      if (looseData && looseData.length > 0 && looseData[0].nb_tracks > 0) {
        return looseData[0].nb_tracks;
      }

      return null;
    } catch(error) {
      if (axios.isAxiosError(error)) {
        logger.debug(`Deezer album track count failed for '${ artist } - ${ album }': ${ error.message }`);
      } else {
        logger.debug(`Deezer album track count failed for '${ artist } - ${ album }': ${ String(error) }`);
      }

      return null;
    }
  }

  /**
   * Get tracks for an album
   */
  async getAlbumTracks(albumId: number): Promise<DeezerAlbumTracksResponse['data']> {
    try {
      const response = await axios.get<DeezerAlbumTracksResponse>(`${ BASE_URL }/album/${ albumId }/tracks`, { timeout: 10000 });

      return response.data.data || [];
    } catch(error) {
      if (axios.isAxiosError(error)) {
        logger.debug(`Deezer get album tracks failed for '${ albumId }': ${ error.message }`);
      } else {
        logger.debug(`Deezer get album tracks failed for '${ albumId }': ${ String(error) }`);
      }

      return [];
    }
  }

  /**
   * Get the best track from an album for preview (first track with preview URL)
   */
  async getAlbumTrack(artist: string, album: string): Promise<{ title: string; previewUrl: string } | null> {
    const albumId = await this.searchAlbum(artist, album);

    if (!albumId) {
      return null;
    }

    const tracks = await this.getAlbumTracks(albumId);

    // Find first track with a preview URL
    const trackWithPreview = tracks.find((t) => t.preview && t.preview.length > 0);

    if (trackWithPreview) {
      return {
        title:      trackWithPreview.title,
        previewUrl: trackWithPreview.preview,
      };
    }

    // If no preview found, return first track name (without preview)
    if (tracks.length > 0) {
      return {
        title:      tracks[0].title,
        previewUrl: '',
      };
    }

    return null;
  }
}

export default DeezerClient;
