import type { SimilarArtistResult, SimilarityProvider } from '@server/types/similarity';

import { LastFmClient } from '@server/services/clients/LastFmClient';

/**
 * Last.fm similarity provider.
 * Wraps the existing LastFmClient.getSimilarArtists() method.
 */
export class LastFmSimilarityProvider implements SimilarityProvider {
  public readonly name = 'lastfm';
  private client: LastFmClient;

  constructor(apiKey: string) {
    this.client = new LastFmClient(apiKey);
  }

  isConfigured(): boolean {
    return true; // If constructed, it's configured
  }

  async getSimilarArtists(
    artistName: string,
    _artistMbid?: string,
    limit: number = 10
  ): Promise<SimilarArtistResult[]> {
    const results = await this.client.getSimilarArtists(artistName, limit);

    return results.map((artist) => ({
      name:     artist.name,
      match:    artist.match,
      mbid:     artist.mbid,
      provider: this.name,
    }));
  }
}
