import { describe, it, expect, afterEach } from 'vitest';
import nock from 'nock';

import { ListenBrainzSimilarityProvider } from './ListenBrainzSimilarityProvider';

describe('ListenBrainzSimilarityProvider', () => {
  afterEach(() => {
    nock.cleanAll();
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

      nock('https://labs.api.listenbrainz.org')
        .post('/similar-artists/json', [{ artist_mbid: artistMbid }])
        .reply(200, [
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
        ]);

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

      // MusicBrainz artist search
      nock('https://musicbrainz.org')
        .get('/ws/2/artist')
        .query({
          query: 'Radiohead',
          limit: 1,
          fmt:   'json',
        })
        .reply(200, {
          count:   1,
          artists: [{ id: artistMbid, name: 'Radiohead' }],
        });

      // ListenBrainz similar artists
      nock('https://labs.api.listenbrainz.org')
        .post('/similar-artists/json', [{ artist_mbid: artistMbid }])
        .reply(200, [
          {
            artist_mbid:     artistMbid,
            similar_artists: [
              {
                artist_mbid: 'sim-mbid', name: 'Similar Artist', score: 0.8 
              },
            ],
          },
        ]);

      const result = await provider.getSimilarArtists('Radiohead', undefined, 10);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Similar Artist');
      expect(result[0].provider).toBe('listenbrainz');
    });

    it('returns empty array when MBID cannot be resolved', async() => {
      const provider = new ListenBrainzSimilarityProvider();

      // MusicBrainz returns no results
      nock('https://musicbrainz.org')
        .get('/ws/2/artist')
        .query({
          query: 'Unknown Artist XYZ',
          limit: 1,
          fmt:   'json',
        })
        .reply(200, { count: 0, artists: [] });

      const result = await provider.getSimilarArtists('Unknown Artist XYZ', undefined, 10);

      expect(result).toEqual([]);
    });

    it('caches MBID resolution results', async() => {
      const provider = new ListenBrainzSimilarityProvider();
      const artistMbid = 'cached-mbid-123';

      // MusicBrainz should only be called once
      nock('https://musicbrainz.org')
        .get('/ws/2/artist')
        .query({
          query: 'Cached Artist',
          limit: 1,
          fmt:   'json',
        })
        .reply(200, {
          count:   1,
          artists: [{ id: artistMbid, name: 'Cached Artist' }],
        });

      // Two ListenBrainz calls
      nock('https://labs.api.listenbrainz.org')
        .post('/similar-artists/json', [{ artist_mbid: artistMbid }])
        .times(2)
        .reply(200, [{ artist_mbid: artistMbid, similar_artists: [] }]);

      // First call - resolves MBID
      await provider.getSimilarArtists('Cached Artist', undefined, 10);

      // Second call - should use cached MBID (MusicBrainz not called again)
      await provider.getSimilarArtists('Cached Artist', undefined, 10);

      // Verify nock interceptors were consumed correctly
      expect(nock.isDone()).toBe(true);
    });
  });
});
