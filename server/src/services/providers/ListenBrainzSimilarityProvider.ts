import type { SimilarArtistResult, SimilarityProvider } from '@server/types/similarity';

import { ListenBrainzClient } from '@server/services/clients/ListenBrainzClient';
import { MusicBrainzClient } from '@server/services/clients/MusicBrainzClient';
import logger from '@server/config/logger';

// TODO: the mbidCache grows indefinitely we should consider a size limit and evict old entries.

/**
 * ListenBrainz similarity provider.
 * Uses ListenBrainz Labs API for similar artists.
 * Requires MBID resolution via MusicBrainz search.
 */
export class ListenBrainzSimilarityProvider implements SimilarityProvider {
  public readonly name = 'listenbrainz';
  private lbClient:  ListenBrainzClient;
  private mbClient:  MusicBrainzClient;
  private mbidCache: Map<string, string | null>;

  constructor() {
    this.lbClient = new ListenBrainzClient({ maxRetries: 2 });
    this.mbClient = new MusicBrainzClient({ maxRetries: 2 });
    this.mbidCache = new Map();
  }

  isConfigured(): boolean {
    return true; // No API key required
  }

  async getSimilarArtists(
    artistName: string,
    artistMbid?: string,
    limit: number = 10,
    signal?: AbortSignal
  ): Promise<SimilarArtistResult[]> {
    // Resolve MBID if not provided
    let mbid: string | undefined = artistMbid;

    if (!mbid) {
      const resolved = await this.resolveMbid(artistName, signal);

      if (!resolved) {
        logger.debug(`ListenBrainz: Could not resolve MBID for "${ artistName }", skipping`);

        return [];
      }

      mbid = resolved;
    }

    const results = await this.lbClient.getSimilarArtists(mbid, limit, signal);

    return results.map((artist) => ({
      name:     artist.name,
      match:    artist.score,
      mbid:     artist.artist_mbid,
      provider: this.name,
    }));
  }

  /**
   * Resolve artist name to MBID using MusicBrainz search.
   * Results are cached to reduce API calls.
   */
  private async resolveMbid(artistName: string, signal?: AbortSignal): Promise<string | null> {
    const cacheKey = artistName.toLowerCase();

    if (this.mbidCache.has(cacheKey)) {
      return this.mbidCache.get(cacheKey) ?? null;
    }

    try {
      const searchResults = await this.mbClient.searchArtists(artistName, 1, signal);

      if (searchResults.results.length > 0) {
        const mbid = searchResults.results[0].mbid;

        this.mbidCache.set(cacheKey, mbid);

        return mbid;
      }
    } catch(error) {
      logger.debug(`Failed to resolve MBID for "${ artistName }": ${ String(error) }`);
    }

    this.mbidCache.set(cacheKey, null);

    return null;
  }
}
