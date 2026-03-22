import {
  describe, it, expect, afterEach, vi 
} from 'vitest';

import { LastFmSimilarityProvider } from './LastFmSimilarityProvider';
import { fetchJson } from '@server/utils/httpClient';

vi.mock('@server/utils/httpClient');
vi.mock('@server/config/logger', () => ({
  default: {
    info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn()
  }
}));

describe('LastFmSimilarityProvider', () => {
  const provider = new LastFmSimilarityProvider('test-api-key');

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('name', () => {
    it('returns "lastfm"', () => {
      expect(provider.name).toBe('lastfm');
    });
  });

  describe('isConfigured', () => {
    it('returns true when constructed', () => {
      expect(provider.isConfigured()).toBe(true);
    });
  });

  describe('getSimilarArtists', () => {
    it('returns similar artists with provider name', async() => {
      vi.mocked(fetchJson).mockResolvedValueOnce({
        data: {
          similarartists: {
            artist: [
              {
                name: 'Thom Yorke', match: '0.85', mbid: 'thom-mbid'
              },
              {
                name: 'Portishead', match: '0.75', mbid: 'portishead-mbid'
              },
            ],
          },
        },
        status: 200,
      });

      const result = await provider.getSimilarArtists('Radiohead', undefined, 10);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        name:     'Thom Yorke',
        match:    0.85,
        mbid:     'thom-mbid',
        provider: 'lastfm',
      });
      expect(result[1]).toEqual({
        name:     'Portishead',
        match:    0.75,
        mbid:     'portishead-mbid',
        provider: 'lastfm',
      });
    });

    it('returns empty array on API error', async() => {
      vi.mocked(fetchJson).mockResolvedValueOnce({
        data:   { error: 6, message: 'Artist not found' },
        status: 200,
      });

      const result = await provider.getSimilarArtists('Unknown Artist', undefined, 10);

      expect(result).toEqual([]);
    });
  });
});
