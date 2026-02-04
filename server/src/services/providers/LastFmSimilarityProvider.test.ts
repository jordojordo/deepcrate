import { describe, it, expect, afterEach } from 'vitest';
import nock from 'nock';

import { LastFmSimilarityProvider } from './LastFmSimilarityProvider';

describe('LastFmSimilarityProvider', () => {
  const provider = new LastFmSimilarityProvider('test-api-key');

  afterEach(() => {
    nock.cleanAll();
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
      nock('https://ws.audioscrobbler.com')
        .get('/2.0/')
        .query({
          method:  'artist.getsimilar',
          artist:  'Radiohead',
          api_key: 'test-api-key',
          limit:   10,
          format:  'json',
        })
        .reply(200, {
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
      nock('https://ws.audioscrobbler.com')
        .get('/2.0/')
        .query({
          method:  'artist.getsimilar',
          artist:  'Unknown Artist',
          api_key: 'test-api-key',
          limit:   10,
          format:  'json',
        })
        .reply(200, { error: 6, message: 'Artist not found' });

      const result = await provider.getSimilarArtists('Unknown Artist', undefined, 10);

      expect(result).toEqual([]);
    });
  });
});
