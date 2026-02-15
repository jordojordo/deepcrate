import type {
  ListenBrainzPlaylistsCreatedForResponse,
  ListenBrainzPlaylistMetadata,
  ListenBrainzPlaylistResponse,
  ListenBrainzRecommendation,
  ListenBrainzRecommendationsResponse,
  ListenBrainzSimilarArtist
} from '@server/types';

import axios from 'axios';

import { BaseClient } from '@server/services/BaseClient';
import { isTransientError } from '@server/utils/errorHandler';
import logger from '@server/config/logger';

import { LB_BASE_URL } from '@server/constants/clients';

/**
 * ListenBrainzClient provides access to ListenBrainz recommendation API.
 * https://api.listenbrainz.org/
 */
export class ListenBrainzClient extends BaseClient {
  /**
   * Fetch recording recommendations for a user
   */
  async fetchRecommendations(
    username: string,
    token: string,
    count: number = 100
  ): Promise<ListenBrainzRecommendation[]> {
    const url = `${ LB_BASE_URL }/cf/recommendation/user/${ username }/recording`;

    try {
      const response = await this.requestWithRetry<ListenBrainzRecommendationsResponse>('get', url, {
        headers: { Authorization: `Token ${ token }` },
        params:  { count },
        timeout: 30000,
      });

      if (response?.status === 204) {
        logger.warn('No recommendations yet - need more listening history');

        return [];
      }

      const mbids = response?.data?.payload?.mbids || [];

      return mbids;
    } catch(error) {
      if (axios.isAxiosError(error)) {
        logger.error(`Failed to fetch ListenBrainz recommendations: ${ error.message }`);
      } else {
        logger.error(`Failed to fetch ListenBrainz recommendations: ${ String(error) }`);
      }

      return [];
    }
  }

  /**
   * Fetch playlists created for a user (no auth required).
   * Returns metadata only (title, identifier, date), not track contents.
   * Use fetchPlaylist() with the playlist MBID to get actual tracks.
   */
  async fetchPlaylistsCreatedFor(
    username: string,
    count: number = 25
  ): Promise<ListenBrainzPlaylistMetadata[]> {
    const url = `${ LB_BASE_URL }/user/${ username }/playlists/createdfor`;

    try {
      const response = await this.requestWithRetry<ListenBrainzPlaylistsCreatedForResponse>('get', url, {
        params:  { count },
        timeout: 30000,
      });

      return response.data.playlists.map((p) => p.playlist);
    } catch(error) {
      if (isTransientError(error)) {
        throw error;
      }

      if (axios.isAxiosError(error)) {
        logger.error(`Failed to fetch playlists created for ${ username }: ${ error.message }`);
      } else {
        logger.error(`Failed to fetch playlists created for ${ username }: ${ String(error) }`);
      }

      return [];
    }
  }

  /**
   * Fetch a full playlist including tracks by MBID (no auth required).
   * Needed because fetchPlaylistsCreatedFor only returns metadata without tracks.
   */
  async fetchPlaylist(playlistMbid: string): Promise<ListenBrainzPlaylistResponse | null> {
    const url = `${ LB_BASE_URL }/playlist/${ playlistMbid }`;

    try {
      const response = await this.requestWithRetry<ListenBrainzPlaylistResponse>('get', url, { timeout: 30000 });

      return response.data;
    } catch(error) {
      if (axios.isAxiosError(error)) {
        logger.error(`Failed to fetch playlist ${ playlistMbid }: ${ error.message }`);
      } else {
        logger.error(`Failed to fetch playlist ${ playlistMbid }: ${ String(error) }`);
      }

      return null;
    }
  }

  /**
   * Find the weekly exploration playlist for a user
   */
  async findWeeklyExplorationPlaylist(username: string): Promise<ListenBrainzPlaylistMetadata | null> {
    const playlists = await this.fetchPlaylistsCreatedFor(username);

    const weeklyPlaylist = playlists.find((p) => p.title.toLowerCase().includes('weekly exploration'));

    return weeklyPlaylist || null;
  }

  /**
   * Get similar artists from ListenBrainz Labs API.
   * Requires the artist's MBID.
   * https://labs.api.listenbrainz.org/similar-artists/json
   */
  async getSimilarArtists(
    artistMbid: string,
    limit: number = 10
  ): Promise<ListenBrainzSimilarArtist[]> {
    const url = 'https://labs.api.listenbrainz.org/similar-artists/json';

    // TODO: Make algorithm configurable — the API accepts a fixed set of enum values
    // See: https://labs.api.listenbrainz.org/similar-artists
    const algorithm = 'session_based_days_9000_session_300_contribution_5_threshold_15_limit_50_skip_30';


    try {
      const response = await this.requestWithRetry('post', url, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 30000,
      }, [{ artist_mbids: [artistMbid], algorithm }]);

      // Response is an array where each element corresponds to an input artist
      const data = response.data;

      if (!Array.isArray(data) || data.length === 0) {
        return [];
      }

      const artistData = data[0];

      if (!artistData || artistData.error) {
        logger.debug(`ListenBrainz similar artists error for ${ artistMbid }: ${ artistData?.error || 'No data' }`);

        return [];
      }

      // The response has a structure like:
      // { artist_mbid: "...", similar_artists: [{ artist_mbid: "...", name: "...", score: 0.5 }, ...] }
      const similarArtists: ListenBrainzSimilarArtist[] = [];
      const rawSimilar = artistData.similar_artists || [];

      for (const artist of rawSimilar.slice(0, limit)) {
        if (artist.artist_mbid && artist.name !== undefined) {
          similarArtists.push({
            artist_mbid: artist.artist_mbid,
            name:        artist.name || '',
            score:       typeof artist.score === 'number' ? artist.score : 0,
          });
        }
      }

      return similarArtists;
    } catch(error) {
      if (axios.isAxiosError(error)) {
        logger.debug(`Failed to get similar artists from ListenBrainz for ${ artistMbid }: ${ error.message }`);
      } else {
        logger.debug(`Failed to get similar artists from ListenBrainz for ${ artistMbid }: ${ String(error) }`);
      }

      return [];
    }
  }

  /**
   * Extract recording MBID from a MusicBrainz recording URL
   * @example "https://musicbrainz.org/recording/abc-123" -> "abc-123"
   */
  static extractRecordingMbid(identifier: string): string | null {
    const match = identifier.match(/\/recording\/([a-f0-9-]+)$/i);

    return match ? match[1] : null;
  }
}

export default ListenBrainzClient;
