import type { SelectedAlbumTrack, AlbumPreviewQuery } from '@server/types/preview';

import { LRUCache } from 'lru-cache';

import logger from '@server/config/logger';
import { getConfig } from '@server/config/settings';
import { DeezerClient } from '@server/services/clients/DeezerClient';
import { SpotifyClient } from '@server/services/clients/SpotifyClient';
import { MusicBrainzClient } from '@server/services/clients/MusicBrainzClient';

interface CachedTrack {
  track: SelectedAlbumTrack | null;
}

/**
 * AlbumTrackSelector handles selecting the best track from an album for preview.
 * Implements a fallback chain: sourceTrack -> Spotify -> Deezer -> MusicBrainz
 * Uses LRU cache to avoid repeated API calls.
 */
export class AlbumTrackSelector {
  private cache:             LRUCache<string, CachedTrack>;
  private deezerClient:      DeezerClient;
  private spotifyClient:     SpotifyClient | null = null;
  private musicBrainzClient: MusicBrainzClient;

  constructor() {
    // LRU cache: 500 entries, 1-hour TTL
    this.cache = new LRUCache<string, CachedTrack>({
      max: 500,
      ttl: 60 * 60 * 1000, // 1 hour
    });

    this.deezerClient = new DeezerClient();
    this.musicBrainzClient = new MusicBrainzClient();

    // Initialize Spotify client if configured
    const config = getConfig();

    if (config.preview?.spotify?.enabled && config.preview.spotify.client_id && config.preview.spotify.client_secret) {
      this.spotifyClient = new SpotifyClient(
        config.preview.spotify.client_id,
        config.preview.spotify.client_secret
      );
      logger.debug('Spotify client initialized for album track selection');
    }
  }

  /**
   * Select the best track from an album for preview
   */
  async selectTrack(query: AlbumPreviewQuery): Promise<SelectedAlbumTrack | null> {
    const {
      artist, album, mbid, sourceTrack
    } = query;

    const cacheKey = this.getCacheKey(artist, album);
    const cached = this.cache.get(cacheKey);

    if (cached !== undefined) {
      logger.debug(`Album track cache hit for '${ artist } - ${ album }'`);

      return cached.track;
    }

    let selectedTrack: SelectedAlbumTrack | null = null;

    // 1. If sourceTrack is provided, use it directly
    if (sourceTrack) {
      logger.debug(`Using sourceTrack '${ sourceTrack }' for album '${ artist } - ${ album }'`);
      selectedTrack = {
        title:      sourceTrack,
        artist,
        previewUrl: null, // Will be resolved by PreviewService
        source:     'musicbrainz', // Source is conceptually from MusicBrainz data
      };
      this.cache.set(cacheKey, { track: selectedTrack });

      return selectedTrack;
    }

    // 2. Try Spotify if configured (provides popularity-sorted tracks)
    if (this.spotifyClient) {
      const spotifyTrack = await this.spotifyClient.getBestAlbumTrack(artist, album);

      if (spotifyTrack) {
        logger.debug(`Selected track from Spotify: '${ spotifyTrack.title }' for '${ artist } - ${ album }'`);
        selectedTrack = {
          title:      spotifyTrack.title,
          artist,
          previewUrl: spotifyTrack.previewUrl || null,
          source:     'spotify',
        };
        this.cache.set(cacheKey, { track: selectedTrack });

        return selectedTrack;
      }
    }

    // 3. Try Deezer
    const deezerTrack = await this.deezerClient.getAlbumTrack(artist, album);

    if (deezerTrack) {
      logger.debug(`Selected track from Deezer: '${ deezerTrack.title }' for '${ artist } - ${ album }'`);
      selectedTrack = {
        title:      deezerTrack.title,
        artist,
        previewUrl: deezerTrack.previewUrl || null,
        source:     'deezer',
      };
      this.cache.set(cacheKey, { track: selectedTrack });

      return selectedTrack;
    }

    // 4. Try MusicBrainz if MBID is provided
    if (mbid) {
      const tracks = await this.musicBrainzClient.getReleaseGroupTracks(mbid);

      if (tracks.length > 0) {
        // Use first track from the album
        const firstTrack = tracks[0];

        logger.debug(`Selected track from MusicBrainz: '${ firstTrack.title }' for '${ artist } - ${ album }'`);
        selectedTrack = {
          title:      firstTrack.title,
          artist,
          previewUrl: null, // MusicBrainz doesn't provide previews
          source:     'musicbrainz',
        };
        this.cache.set(cacheKey, { track: selectedTrack });

        return selectedTrack;
      }
    }

    // Cache negative result to avoid repeated lookups
    logger.debug(`No track found for album '${ artist } - ${ album }'`);
    this.cache.set(cacheKey, { track: null });

    return null;
  }

  /**
   * Generate cache key from artist and album names
   */
  private getCacheKey(artist: string, album: string): string {
    return `${ artist.toLowerCase() }:${ album.toLowerCase() }`;
  }

  /**
   * Clear the album track cache
   */
  clearCache(): void {
    this.cache.clear();
    logger.debug('Album track selection cache cleared');
  }
}

export default AlbumTrackSelector;
