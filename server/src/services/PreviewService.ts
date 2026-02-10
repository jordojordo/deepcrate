import type { PreviewResponse, AlbumPreviewResponse, AlbumPreviewQuery } from '@server/types/preview';

import { LRUCache } from 'lru-cache';

import logger from '@server/config/logger';
import { getConfig } from '@server/config/settings';
import { DeezerClient } from './clients/DeezerClient';
import { SpotifyClient } from './clients/SpotifyClient';
import { AlbumTrackSelector } from './AlbumTrackSelector';

interface CachedPreview {
  url:    string | null;
  source: 'deezer' | 'spotify' | null;
}

/**
 * PreviewService handles fetching audio preview URLs from Deezer and Spotify.
 * Uses LRU cache to avoid repeated API calls.
 */
export class PreviewService {
  private cache:              LRUCache<string, CachedPreview>;
  private deezerClient:       DeezerClient;
  private spotifyClient:      SpotifyClient | null = null;
  private albumTrackSelector: AlbumTrackSelector;

  constructor() {
    // LRU cache: 1000 entries, 1-hour TTL
    this.cache = new LRUCache<string, CachedPreview>({
      max: 1000,
      ttl: 60 * 60 * 1000, // 1 hour
    });

    this.deezerClient = new DeezerClient();
    this.albumTrackSelector = new AlbumTrackSelector();

    // Initialize Spotify client if configured
    const config = getConfig();

    if (config.preview?.spotify?.enabled && config.preview.spotify.client_id && config.preview.spotify.client_secret) {
      this.spotifyClient = new SpotifyClient(
        config.preview.spotify.client_id,
        config.preview.spotify.client_secret
      );
      logger.info('Spotify preview client initialized');
    }
  }

  /**
   * Get preview URL for a track
   */
  async getPreview(artist: string, track: string): Promise<PreviewResponse> {
    const config = getConfig();

    if (config.preview?.enabled === false) {
      return {
        url: null, source: null, available: false
      };
    }

    const cacheKey = this.getCacheKey(artist, track);
    const cached = this.cache.get(cacheKey);

    if (cached !== undefined) {
      logger.debug(`Preview cache hit for '${ artist } - ${ track }'`);

      return {
        url:       cached.url,
        source:    cached.source,
        available: cached.url !== null,
      };
    }

    // Try Deezer first (no API key required)
    const deezerUrl = await this.deezerClient.searchTrack(artist, track);

    if (deezerUrl) {
      const result: CachedPreview = { url: deezerUrl, source: 'deezer' };

      this.cache.set(cacheKey, result);
      logger.debug(`Preview found on Deezer for '${ artist } - ${ track }'`);

      return {
        url: deezerUrl, source: 'deezer', available: true
      };
    }

    // Try Spotify as fallback if configured
    if (this.spotifyClient) {
      const spotifyUrl = await this.spotifyClient.searchTrack(artist, track);

      if (spotifyUrl) {
        const result: CachedPreview = { url: spotifyUrl, source: 'spotify' };

        this.cache.set(cacheKey, result);
        logger.debug(`Preview found on Spotify for '${ artist } - ${ track }'`);

        return {
          url: spotifyUrl, source: 'spotify', available: true
        };
      }
    }

    // Cache negative result to avoid repeated lookups
    const notFound: CachedPreview = { url: null, source: null };

    this.cache.set(cacheKey, notFound);
    logger.debug(`No preview found for '${ artist } - ${ track }'`);

    return {
      url: null, source: null, available: false
    };
  }

  /**
   * Get preview URL for an album by selecting the best track
   */
  async getAlbumPreview(query: AlbumPreviewQuery): Promise<AlbumPreviewResponse> {
    const config = getConfig();

    if (config.preview?.enabled === false) {
      return {
        url:           null,
        source:        null,
        available:     false,
        selectedTrack: null,
      };
    }

    // 1. Use AlbumTrackSelector to get best track
    const selectedTrack = await this.albumTrackSelector.selectTrack(query);

    if (!selectedTrack) {
      logger.debug(`No track found for album '${ query.artist } - ${ query.album }'`);

      return {
        url:           null,
        source:        null,
        available:     false,
        selectedTrack: null,
      };
    }

    // 2. If the selected track already has a preview URL, return it
    if (selectedTrack.previewUrl) {
      logger.debug(`Using existing preview URL for '${ selectedTrack.title }' from ${ selectedTrack.source }`);

      return {
        url:           selectedTrack.previewUrl,
        source:        selectedTrack.source === 'musicbrainz' ? null : selectedTrack.source,
        available:     true,
        selectedTrack: selectedTrack.title,
      };
    }

    // 3. Otherwise, search for preview URL using existing getPreview()
    logger.debug(`Searching for preview URL for '${ selectedTrack.artist } - ${ selectedTrack.title }'`);
    const preview = await this.getPreview(selectedTrack.artist, selectedTrack.title);

    return {
      url:           preview.url,
      source:        preview.source,
      available:     preview.available,
      selectedTrack: selectedTrack.title,
    };
  }

  /**
   * Generate cache key from artist and track names
   */
  private getCacheKey(artist: string, track: string): string {
    return `${ artist.toLowerCase() }:${ track.toLowerCase() }`;
  }

  /**
   * Clear the preview cache
   */
  clearCache(): void {
    this.cache.clear();
    logger.debug('Preview cache cleared');
  }
}

export default PreviewService;
