import type {
  AlbumInfo,
  ListenBrainzPlaylistsCreatedForResponse,
  ListenBrainzPlaylistMetadata,
  ListenBrainzPlaylistResponse,
  ListenBrainzRecommendation,
  ListenBrainzRecommendationsResponse,
  ListenBrainzRecordingMetadata,
  ListenBrainzRecordingMetadataResponse,
  ListenBrainzSimilarArtist,
  RecordingInfo,
  RetryConfig
} from '@server/types';

import { BaseClient } from '@server/services/BaseClient';
import { isTransientError } from '@server/utils/errorHandler';
import logger from '@server/config/logger';

import { LB_BASE_URL, LB_METADATA_BATCH_SIZE } from '@server/constants/clients';

/**
 * ListenBrainzClient provides access to ListenBrainz recommendation API.
 * https://api.listenbrainz.org/
 */
export class ListenBrainzClient extends BaseClient {
  constructor(retryConfig?: Partial<RetryConfig>) {
    super(retryConfig);
  }

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
      logger.error(`Failed to fetch ListenBrainz recommendations: ${ error instanceof Error ? error.message : String(error) }`);

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

      logger.error(`Failed to fetch playlists created for ${ username }: ${ error instanceof Error ? error.message : String(error) }`);

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
      logger.error(`Failed to fetch playlist ${ playlistMbid }: ${ error instanceof Error ? error.message : String(error) }`);

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
    limit: number = 10,
    signal?: AbortSignal
  ): Promise<ListenBrainzSimilarArtist[]> {
    const url = 'https://labs.api.listenbrainz.org/similar-artists/json';

    // TODO: Make algorithm configurable — the API accepts a fixed set of enum values
    // See: https://labs.api.listenbrainz.org/similar-artists
    const algorithm = 'session_based_days_9000_session_300_contribution_5_threshold_15_limit_50_skip_30';


    try {
      const response = await this.requestWithRetry('post', url, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 30000,
        signal,
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
      logger.debug(`Failed to get similar artists from ListenBrainz for ${ artistMbid }: ${ error instanceof Error ? error.message : String(error) }`);

      return [];
    }
  }

  /**
   * Fetch artist and release metadata for many recordings in batched requests.
   *
   * Replaces a MusicBrainz lookup per recording. Recordings missing
   * from the result (unknown to ListenBrainz, or a failed batch) should fall
   * back to MusicBrainz.
   */
  async getRecordingMetadata(recordingMbids: string[]): Promise<Map<string, ListenBrainzRecordingMetadata>> {
    const url = `${ LB_BASE_URL }/metadata/recording/`;
    const metadata = new Map<string, ListenBrainzRecordingMetadata>();

    for (let i = 0; i < recordingMbids.length; i += LB_METADATA_BATCH_SIZE) {
      const batch = recordingMbids.slice(i, i + LB_METADATA_BATCH_SIZE);

      try {
        const response = await this.requestWithRetry<ListenBrainzRecordingMetadataResponse>('post', url, { timeout: 30000 }, {
          recording_mbids: batch,
          inc:             'artist release',
        });

        for (const [mbid, entry] of Object.entries(response.data ?? {})) {
          metadata.set(mbid, entry);
        }
      } catch(error) {
        logger.warn(`Failed to fetch ListenBrainz metadata for ${ batch.length } recordings, falling back to MusicBrainz: ${ error instanceof Error ? error.message : String(error) }`);
      }
    }

    return metadata;
  }

  /**
   * Convert batch metadata to the AlbumInfo shape MusicBrainzClient returns.
   * Returns null when ListenBrainz has no release group for the recording.
   */
  static toAlbumInfo(recordingMbid: string, metadata: ListenBrainzRecordingMetadata): AlbumInfo | null {
    const artist = ListenBrainzClient.artistName(metadata);
    const release = metadata.release;

    if (!artist || !release?.release_group_mbid || !release.name) {
      return null;
    }

    return {
      artist,
      title:      release.name,
      mbid:       release.release_group_mbid,
      recordingMbid,
      trackTitle: metadata.recording?.name ?? '',
      year:       release.year ?? undefined,
    };
  }

  /**
   * Convert batch metadata to the RecordingInfo shape MusicBrainzClient returns.
   */
  static toRecordingInfo(recordingMbid: string, metadata: ListenBrainzRecordingMetadata): RecordingInfo | null {
    const artist = ListenBrainzClient.artistName(metadata);
    const title = metadata.recording?.name;

    if (!artist || !title) {
      return null;
    }

    return {
      artist,
      title,
      mbid:             recordingMbid,
      releaseGroupMbid: metadata.release?.release_group_mbid,
    };
  }

  /**
   * Join credited artist names with ' & ', matching MusicBrainzClient so the
   * same recording yields the same artist string (and slskd search) either way.
   */
  private static artistName(metadata: ListenBrainzRecordingMetadata): string {
    const names = (metadata.artist?.artists ?? []).map((a) => a.name).filter(Boolean);

    return names.length > 0 ? names.join(' & ') : (metadata.artist?.name ?? '');
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
