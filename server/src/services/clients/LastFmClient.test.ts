import {
  describe, it, expect, afterEach, vi 
} from 'vitest';

import { LastFmClient } from './LastFmClient';
import { HttpError } from '@server/utils/HttpError';
import { fetchJson } from '@server/utils/httpClient';

vi.mock('@server/utils/httpClient');
vi.mock('@server/config/logger', () => ({
  default: {
    info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn()
  }
}));

describe('LastFmClient', () => {
  const client = new LastFmClient('test-api-key');

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getArtistTopTags', () => {
    it('returns tags lowercased and limited by count', async() => {
      vi.mocked(fetchJson).mockResolvedValueOnce({
        data: {
          toptags: {
            tag: [
              { name: 'Alternative Rock', count: 100 },
              { name: 'Electronic', count: 80 },
              { name: 'Indie', count: 60 },
            ],
          },
        },
        status: 200,
      });

      const result = await client.getArtistTopTags('Radiohead');

      expect(result).toEqual([
        { name: 'alternative rock', count: 100 },
        { name: 'electronic', count: 80 },
        { name: 'indie', count: 60 },
      ]);
    });

    it('returns empty array on Last.fm API error response', async() => {
      vi.mocked(fetchJson).mockResolvedValueOnce({
        data: {
          error:   6,
          message: 'Artist not found',
        },
        status: 200,
      });

      const result = await client.getArtistTopTags('NonExistentArtist');

      expect(result).toEqual([]);
    });

    it('returns empty array on HTTP error', async() => {
      vi.mocked(fetchJson).mockRejectedValueOnce(
        new HttpError('HTTP 500: Internal Server Error', 500)
      );

      const result = await client.getArtistTopTags('SomeArtist');

      expect(result).toEqual([]);
    });

    it('respects custom limit parameter (client-side slice)', async() => {
      vi.mocked(fetchJson).mockResolvedValueOnce({
        data: {
          toptags: {
            tag: [
              { name: 'Ambient', count: 90 },
              { name: 'Electronic', count: 85 },
              { name: 'IDM', count: 70 },
              { name: 'Experimental', count: 50 },
            ],
          },
        },
        status: 200,
      });

      const result = await client.getArtistTopTags('Boards of Canada', 3);

      expect(result).toHaveLength(3);
      expect(result[0].name).toBe('ambient');
    });

    it('returns empty array when toptags is missing', async() => {
      vi.mocked(fetchJson).mockResolvedValueOnce({
        data:   {},
        status: 200,
      });

      const result = await client.getArtistTopTags('SomeArtist');

      expect(result).toEqual([]);
    });
  });
});
