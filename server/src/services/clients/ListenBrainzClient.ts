import type {
  ListenBrainzPlaylistsCreatedForResponse,
  ListenBrainzPlaylistMetadata,
  ListenBrainzPlaylistResponse,
  ListenBrainzRecommendation,
} from '@server/types/listenbrainz';

import axios from 'axios';
import logger from '@server/config/logger';



/**
 * ListenBrainzClient provides access to ListenBrainz recommendation API.
 * https://api.listenbrainz.org/
 */
export class ListenBrainzClient {
  private baseUrl = 'https://api.listenbrainz.org/1';

  /**
   * Fetch recording recommendations for a user
   */
  async fetchRecommendations(
    username: string,
    token: string,
    count: number = 100
  ): Promise<ListenBrainzRecommendation[]> {
    const url = `${ this.baseUrl }/cf/recommendation/user/${ username }/recording`;

    try {
      const response = await axios.get(url, {
        headers: { Authorization: `Token ${ token }` },
        params:  { count },
        timeout: 30000,
      });

      if (response.status === 204) {
        logger.warn('No recommendations yet - need more listening history');

        return [];
      }

      const mbids = response.data?.payload?.mbids || [];

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
    const url = `${ this.baseUrl }/user/${ username }/playlists/createdfor`;

    try {
      const response = await axios.get<ListenBrainzPlaylistsCreatedForResponse>(url, {
        params:  { count },
        timeout: 30000,
      });

      return response.data.playlists.map((p) => p.playlist);
    } catch(error) {
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
    const url = `${ this.baseUrl }/playlist/${ playlistMbid }`;

    try {
      const response = await axios.get<ListenBrainzPlaylistResponse>(url, { timeout: 30000 });

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

    const weeklyPlaylist = playlists.find((p) => p.identifier.includes('weekly-exploration'));

    return weeklyPlaylist || null;
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
