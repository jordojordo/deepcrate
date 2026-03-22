import {
  describe, it, expect, afterEach, vi 
} from 'vitest';

import { ListenBrainzSimilarityProvider } from './ListenBrainzSimilarityProvider';
import { fetchJson } from '@server/utils/httpClient';

vi.mock('@server/utils/httpClient');
vi.mock('@server/config/logger', () => ({
  default: {
    info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn()
  }
}));

describe('ListenBrainzSimilarityProvider', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('name', () => {
    it('returns "listenbrainz"', () => {
      const provider = new ListenBrainzSimilarityProvider();

      expect(provider.name).toBe('listenbrainz');
    });
  });

  describe('isConfigured', () => {
    it('returns true (no API key required)', () => {
      const provider = new ListenBrainzSimilarityProvider();

      expect(provider.isConfigured()).toBe(true);
    });
  });

  describe('getSimilarArtists', () => {
    it('returns similar artists when MBID is provided', async() => {
      const provider = new ListenBrainzSimilarityProvider();
      const artistMbid = 'radiohead-mbid-123';

      vi.mocked(fetchJson).mockResolvedValueOnce({
        data: [
          {
            artist_mbid:     artistMbid,
            similar_artists: [
              {
                artist_mbid: 'thom-mbid', name: 'Thom Yorke', score: 0.85
              },
              {
                artist_mbid: 'portishead-mbid', name: 'Portishead', score: 0.75
              },
            ],
          },
        ],
        status: 200,
      });

      const result = await provider.getSimilarArtists('Radiohead', artistMbid, 10);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        name:     'Thom Yorke',
        match:    0.85,
        mbid:     'thom-mbid',
        provider: 'listenbrainz',
      });
    });

    it('resolves MBID via MusicBrainz when not provided', async() => {
      const provider = new ListenBrainzSimilarityProvider();
      const artistMbid = 'resolved-mbid-123';

      // First call: MusicBrainz artist search
      vi.mocked(fetchJson).mockResolvedValueOnce({
        data: {
          count:   1,
          artists: [{ id: artistMbid, name: 'Radiohead' }],
        },
        status: 200,
      });

      // Second call: ListenBrainz similar artists
      vi.mocked(fetchJson).mockResolvedValueOnce({
        data: [
          {
            artist_mbid:     artistMbid,
            similar_artists: [
              {
                artist_mbid: 'sim-mbid', name: 'Similar Artist', score: 0.8
              },
            ],
          },
        ],
        status: 200,
      });

      const result = await provider.getSimilarArtists('Radiohead', undefined, 10);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Similar Artist');
      expect(result[0].provider).toBe('listenbrainz');
    });

    it('returns empty array when MBID cannot be resolved', async() => {
      const provider = new ListenBrainzSimilarityProvider();

      // MusicBrainz returns no results
      vi.mocked(fetchJson).mockResolvedValueOnce({
        data:   { count: 0, artists: [] },
        status: 200,
      });

      const result = await provider.getSimilarArtists('Unknown Artist XYZ', undefined, 10);

      expect(result).toEqual([]);
    });

    it('caches MBID resolution results', async() => {
      const provider = new ListenBrainzSimilarityProvider();
      const artistMbid = 'cached-mbid-123';

      // First call: MusicBrainz artist search
      vi.mocked(fetchJson).mockResolvedValueOnce({
        data: {
          count:   1,
          artists: [{ id: artistMbid, name: 'Cached Artist' }],
        },
        status: 200,
      });

      // First ListenBrainz call
      vi.mocked(fetchJson).mockResolvedValueOnce({
        data:   [{ artist_mbid: artistMbid, similar_artists: [] }],
        status: 200,
      });

      // Second ListenBrainz call (no MusicBrainz call needed - cached)
      vi.mocked(fetchJson).mockResolvedValueOnce({
        data:   [{ artist_mbid: artistMbid, similar_artists: [] }],
        status: 200,
      });

      // First call - resolves MBID
      await provider.getSimilarArtists('Cached Artist', undefined, 10);

      // Second call - should use cached MBID (MusicBrainz not called again)
      await provider.getSimilarArtists('Cached Artist', undefined, 10);

      // MusicBrainz search (1) + ListenBrainz (2) = 3 total calls
      expect(fetchJson).toHaveBeenCalledTimes(3);
    });
  });
});
