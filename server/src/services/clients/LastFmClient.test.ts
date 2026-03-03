import { describe, it, expect, afterEach } from 'vitest';
import nock from 'nock';

import { LastFmClient } from './LastFmClient';
import { LASTFM_BASE_URL } from '@server/constants/clients';

const LASTFM_HOST = new URL(LASTFM_BASE_URL).origin;
const LASTFM_PATH = new URL(LASTFM_BASE_URL).pathname;

describe('LastFmClient', () => {
  const client = new LastFmClient('test-api-key');

  afterEach(() => {
    nock.cleanAll();
  });

  describe('getArtistTopTags', () => {
    it('returns tags lowercased and limited by count', async() => {
      nock(LASTFM_HOST)
        .get(LASTFM_PATH)
        .query({
          method:  'artist.gettoptags',
          artist:  'Radiohead',
          api_key: 'test-api-key',
          format:  'json',
        })
        .reply(200, {
          toptags: {
            tag: [
              { name: 'Alternative Rock', count: 100 },
              { name: 'Electronic', count: 80 },
              { name: 'Indie', count: 60 },
            ],
          },
        });

      const result = await client.getArtistTopTags('Radiohead');

      expect(result).toEqual([
        { name: 'alternative rock', count: 100 },
        { name: 'electronic', count: 80 },
        { name: 'indie', count: 60 },
      ]);
    });

    it('returns empty array on Last.fm API error response', async() => {
      nock(LASTFM_HOST)
        .get(LASTFM_PATH)
        .query(true)
        .reply(200, {
          error:   6,
          message: 'Artist not found',
        });

      const result = await client.getArtistTopTags('NonExistentArtist');

      expect(result).toEqual([]);
    });

    it('returns empty array on HTTP error', async() => {
      nock(LASTFM_HOST)
        .get(LASTFM_PATH)
        .query(true)
        .reply(500);

      const result = await client.getArtistTopTags('SomeArtist');

      expect(result).toEqual([]);
    });

    it('respects custom limit parameter (client-side slice)', async() => {
      nock(LASTFM_HOST)
        .get(LASTFM_PATH)
        .query(true)  // match any query params
        .reply(200, {
          toptags: {
            tag: [
              { name: 'Ambient', count: 90 },
              { name: 'Electronic', count: 85 },
              { name: 'IDM', count: 70 },
              { name: 'Experimental', count: 50 },
            ],
          },
        });

      const result = await client.getArtistTopTags('Boards of Canada', 3);

      expect(result).toHaveLength(3);
      expect(result[0].name).toBe('ambient');
    });

    it('returns empty array when toptags is missing', async() => {
      nock(LASTFM_HOST)
        .get(LASTFM_PATH)
        .query(true)
        .reply(200, {});

      const result = await client.getArtistTopTags('SomeArtist');

      expect(result).toEqual([]);
    });
  });
});
