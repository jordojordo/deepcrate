import type {
  SpotifyTokenResponse,
  SpotifySearchResponse,
  SpotifyAlbumSearchResponse,
  SpotifyAlbumTracksResponse,
  SpotifyAlbumTrack,
} from '@server/types/preview';

import axios from 'axios';
import logger from '@server/config/logger';
import { SPOTIFY_AUTH_URL, SPOTIFY_API_URL } from '@server/constants/clients';

/**
 * SpotifyClient provides access to Spotify API for track preview URLs.
 * Requires client credentials (client_id and client_secret) from config.
 * Uses Client Credentials OAuth flow.
 * https://developer.spotify.com/documentation/web-api
 */
export class SpotifyClient {
  private clientId:     string;
  private clientSecret: string;
  private accessToken:  string | null = null;
  private tokenExpiry:  number = 0;

  constructor(clientId: string, clientSecret: string) {
    this.clientId = clientId;
    this.clientSecret = clientSecret;
  }

  /**
   * Search for a track and get its preview URL
   */
  async searchTrack(artist: string, track: string): Promise<string | null> {
    try {
      await this.ensureAccessToken();

      const query = `artist:${ artist } track:${ track }`;
      const response = await axios.get<SpotifySearchResponse>(`${ SPOTIFY_API_URL }/search`, {
        params: {
          q:     query,
          type:  'track',
          limit: 5,
        },
        headers: { Authorization: `Bearer ${ this.accessToken }` },
        timeout: 10000,
      });

      const tracks = response.data.tracks?.items || [];

      // Find first track with preview URL
      const trackWithPreview = tracks.find((t) => t.preview_url);

      if (trackWithPreview?.preview_url) {
        return trackWithPreview.preview_url;
      }

      return null;
    } catch(error) {
      if (axios.isAxiosError(error)) {
        logger.debug(`Spotify search failed for '${ artist } - ${ track }': ${ error.message }`);
      } else {
        logger.debug(`Spotify search failed for '${ artist } - ${ track }': ${ String(error) }`);
      }

      return null;
    }
  }

  /**
   * Search for an album and return its Spotify ID
   */
  async searchAlbum(artist: string, album: string): Promise<string | null> {
    try {
      await this.ensureAccessToken();

      const query = `artist:${ artist } album:${ album }`;
      const response = await axios.get<SpotifyAlbumSearchResponse>(`${ SPOTIFY_API_URL }/search`, {
        params: {
          q:     query,
          type:  'album',
          limit: 5,
        },
        headers: { Authorization: `Bearer ${ this.accessToken }` },
        timeout: 10000,
      });

      const albums = response.data.albums?.items || [];

      if (albums.length > 0) {
        return albums[0].id;
      }

      return null;
    } catch(error) {
      if (axios.isAxiosError(error)) {
        logger.debug(`Spotify album search failed for '${ artist } - ${ album }': ${ error.message }`);
      } else {
        logger.debug(`Spotify album search failed for '${ artist } - ${ album }': ${ String(error) }`);
      }

      return null;
    }
  }

  /**
   * Get tracks for an album sorted by popularity (Spotify tracks have implicit popularity)
   */
  async getAlbumTracks(albumId: string): Promise<SpotifyAlbumTrack[]> {
    try {
      await this.ensureAccessToken();

      const response = await axios.get<SpotifyAlbumTracksResponse>(`${ SPOTIFY_API_URL }/albums/${ albumId }/tracks`, {
        params:  { limit: 50 },
        headers: { Authorization: `Bearer ${ this.accessToken }` },
        timeout: 10000,
      });

      return response.data.items || [];
    } catch(error) {
      if (axios.isAxiosError(error)) {
        logger.debug(`Spotify get album tracks failed for '${ albumId }': ${ error.message }`);
      } else {
        logger.debug(`Spotify get album tracks failed for '${ albumId }': ${ String(error) }`);
      }

      return [];
    }
  }

  /**
   * Get the best track from an album for preview (first track with preview URL)
   */
  async getBestAlbumTrack(artist: string, album: string): Promise<{ title: string; previewUrl: string } | null> {
    const albumId = await this.searchAlbum(artist, album);

    if (!albumId) {
      return null;
    }

    const tracks = await this.getAlbumTracks(albumId);

    // Find first track with a preview URL
    const trackWithPreview = tracks.find((t) => t.preview_url);

    if (trackWithPreview?.preview_url) {
      return {
        title:      trackWithPreview.name,
        previewUrl: trackWithPreview.preview_url,
      };
    }

    // If no preview found, return first track name (without preview)
    if (tracks.length > 0) {
      return {
        title:      tracks[0].name,
        previewUrl: '',
      };
    }

    return null;
  }

  /**
   * Ensure we have a valid access token
   */
  private async ensureAccessToken(): Promise<void> {
    // Check if token is still valid (with 60 second buffer)
    if (this.accessToken && Date.now() < this.tokenExpiry - 60000) {
      return;
    }

    const credentials = Buffer.from(`${ this.clientId }:${ this.clientSecret }`).toString('base64');

    const response = await axios.post<SpotifyTokenResponse>(SPOTIFY_AUTH_URL, 'grant_type=client_credentials', {
      headers: {
        'Authorization': `Basic ${ credentials }`,
        'Content-Type':  'application/x-www-form-urlencoded',
      },
      timeout: 10000,
    });

    this.accessToken = response.data.access_token;
    this.tokenExpiry = Date.now() + (response.data.expires_in * 1000);

    logger.debug('Spotify access token refreshed');
  }
}

export default SpotifyClient;
