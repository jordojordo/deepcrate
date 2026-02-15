import { describe, it, expect, afterEach } from 'vitest';
import nock from 'nock';

import { ListenBrainzClient } from './ListenBrainzClient';
import { isTransientError } from '@server/utils/errorHandler';

describe('ListenBrainzClient', () => {
  const client = new ListenBrainzClient();

  afterEach(() => {
    nock.cleanAll();
  });

  describe('fetchRecommendations', () => {
    it('returns recording MBIDs with scores', async() => {
      nock('https://api.listenbrainz.org')
        .get('/1/cf/recommendation/user/testuser/recording')
        .query({ count: 100 })
        .reply(200, {
          payload: {
            mbids: [
              { recording_mbid: 'rec-1', score: 0.95 },
              { recording_mbid: 'rec-2', score: 0.85 },
            ],
          },
        });

      const result = await client.fetchRecommendations('testuser', 'token123', 100);

      expect(result).toEqual([
        { recording_mbid: 'rec-1', score: 0.95 },
        { recording_mbid: 'rec-2', score: 0.85 },
      ]);
    });

    it('returns empty array on 204 (no content)', async() => {
      nock('https://api.listenbrainz.org')
        .get('/1/cf/recommendation/user/testuser/recording')
        .query({ count: 100 })
        .reply(204);

      const result = await client.fetchRecommendations('testuser', 'token123', 100);

      expect(result).toEqual([]);
    });

    it('returns empty array on error', async() => {
      nock('https://api.listenbrainz.org')
        .get('/1/cf/recommendation/user/testuser/recording')
        .query({ count: 100 })
        .reply(500);

      const result = await client.fetchRecommendations('testuser', 'token123', 100);

      expect(result).toEqual([]);
    });
  });

  describe('fetchPlaylistsCreatedFor', () => {
    it('returns playlist metadata array', async() => {
      nock('https://api.listenbrainz.org')
        .get('/1/user/testuser/playlists/createdfor')
        .query({ count: 25 })
        .reply(200, {
          count:     2,
          offset:    0,
          playlists: [
            {
              playlist: {
                identifier: 'https://listenbrainz.org/playlist/abc-123',
                title:      'Weekly Exploration for testuser',
                creator:    'listenbrainz',
                date:       '2024-01-15',
                extension:  {
                  'https://musicbrainz.org/doc/jspf#playlist': {
                    public:      true,
                    created_for: 'testuser',
                  },
                },
              },
            },
            {
              playlist: {
                identifier: 'https://listenbrainz.org/playlist/def-456',
                title:      'Some other playlist',
                creator:    'listenbrainz',
                date:       '2024-01-10',
                extension:  {
                  'https://musicbrainz.org/doc/jspf#playlist': {
                    public:      true,
                    created_for: 'testuser',
                  },
                },
              },
            },
          ],
        });

      const result = await client.fetchPlaylistsCreatedFor('testuser');

      expect(result).toHaveLength(2);
      expect(result[0].identifier).toBe('https://listenbrainz.org/playlist/abc-123');
      expect(result[0].title).toBe('Weekly Exploration for testuser');
    });

    it('returns empty array on error', async() => {
      nock('https://api.listenbrainz.org')
        .get('/1/user/testuser/playlists/createdfor')
        .query({ count: 25 })
        .reply(404);

      const result = await client.fetchPlaylistsCreatedFor('testuser');

      expect(result).toEqual([]);
    });
  });

  describe('fetchPlaylist', () => {
    it('returns full playlist with tracks', async() => {
      const playlistMbid = 'abc-123-def-456';

      nock('https://api.listenbrainz.org')
        .get(`/1/playlist/${ playlistMbid }`)
        .reply(200, {
          playlist: {
            identifier: `https://listenbrainz.org/playlist/${ playlistMbid }`,
            title:      'Weekly Exploration',
            creator:    'listenbrainz',
            date:       '2024-01-15',
            track:      [
              {
                identifier: 'https://musicbrainz.org/recording/rec-1',
                title:      'Test Track 1',
                creator:    'Test Artist 1',
              },
              {
                identifier: 'https://musicbrainz.org/recording/rec-2',
                title:      'Test Track 2',
                creator:    'Test Artist 2',
              },
            ],
          },
        });

      const result = await client.fetchPlaylist(playlistMbid);

      expect(result).not.toBeNull();
      expect(result!.playlist.track).toHaveLength(2);
      expect(result!.playlist.track[0].title).toBe('Test Track 1');
    });

    it('returns null on error', async() => {
      nock('https://api.listenbrainz.org')
        .get('/1/playlist/nonexistent')
        .reply(404);

      const result = await client.fetchPlaylist('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('findWeeklyExplorationPlaylist', () => {
    it('finds playlist with weekly-exploration in identifier', async() => {
      nock('https://api.listenbrainz.org')
        .get('/1/user/testuser/playlists/createdfor')
        .query({ count: 25 })
        .reply(200, {
          count:     2,
          offset:    0,
          playlists: [
            {
              playlist: {
                identifier: 'https://listenbrainz.org/playlist/other-playlist-123',
                title:      'Daily Jams',
                creator:    'listenbrainz',
                date:       '2024-01-15',
                extension:  {
                  'https://musicbrainz.org/doc/jspf#playlist': {
                    public:      true,
                    created_for: 'testuser',
                  },
                },
              },
            },
            {
              playlist: {
                identifier: 'https://listenbrainz.org/playlist/weekly-exploration-abc-123',
                title:      'Weekly Exploration for testuser',
                creator:    'listenbrainz',
                date:       '2024-01-10',
                extension:  {
                  'https://musicbrainz.org/doc/jspf#playlist': {
                    public:      true,
                    created_for: 'testuser',
                  },
                },
              },
            },
          ],
        });

      const result = await client.findWeeklyExplorationPlaylist('testuser');

      expect(result).not.toBeNull();
      expect(result!.identifier).toContain('weekly-exploration');
    });

    it('returns null when no weekly playlist exists', async() => {
      nock('https://api.listenbrainz.org')
        .get('/1/user/testuser/playlists/createdfor')
        .query({ count: 25 })
        .reply(200, {
          count:     1,
          offset:    0,
          playlists: [
            {
              playlist: {
                identifier: 'https://listenbrainz.org/playlist/other-playlist-123',
                title:      'Daily Jams',
                creator:    'listenbrainz',
                date:       '2024-01-15',
                extension:  {
                  'https://musicbrainz.org/doc/jspf#playlist': {
                    public:      true,
                    created_for: 'testuser',
                  },
                },
              },
            },
          ],
        });

      const result = await client.findWeeklyExplorationPlaylist('testuser');

      expect(result).toBeNull();
    });
  });

  describe('getSimilarArtists', () => {
    it('returns similar artists with scores', async() => {
      const artistMbid = 'abc-123-def-456';

      nock('https://labs.api.listenbrainz.org')
        .post('/similar-artists/json', [{ artist_mbids: [artistMbid], algorithm: 'session_based_days_9000_session_300_contribution_5_threshold_15_limit_50_skip_30' }])
        .reply(200, [
          {
            artist_mbid:     artistMbid,
            similar_artists: [
              {
                artist_mbid: 'sim-1', name: 'Similar Artist 1', score: 0.85
              },
              {
                artist_mbid: 'sim-2', name: 'Similar Artist 2', score: 0.75
              },
            ],
          },
        ]);

      const result = await client.getSimilarArtists(artistMbid, 10);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        artist_mbid: 'sim-1',
        name:        'Similar Artist 1',
        score:       0.85,
      });
      expect(result[1]).toEqual({
        artist_mbid: 'sim-2',
        name:        'Similar Artist 2',
        score:       0.75,
      });
    });

    it('respects limit parameter', async() => {
      const artistMbid = 'abc-123-def-456';

      nock('https://labs.api.listenbrainz.org')
        .post('/similar-artists/json', [{ artist_mbids: [artistMbid], algorithm: 'session_based_days_9000_session_300_contribution_5_threshold_15_limit_50_skip_30' }])
        .reply(200, [
          {
            artist_mbid:     artistMbid,
            similar_artists: [
              {
                artist_mbid: 'sim-1', name: 'Artist 1', score: 0.9
              },
              {
                artist_mbid: 'sim-2', name: 'Artist 2', score: 0.8
              },
              {
                artist_mbid: 'sim-3', name: 'Artist 3', score: 0.7
              },
            ],
          },
        ]);

      const result = await client.getSimilarArtists(artistMbid, 2);

      expect(result).toHaveLength(2);
    });

    it('returns empty array when no similar artists found', async() => {
      const artistMbid = 'abc-123-def-456';

      nock('https://labs.api.listenbrainz.org')
        .post('/similar-artists/json', [{ artist_mbids: [artistMbid], algorithm: 'session_based_days_9000_session_300_contribution_5_threshold_15_limit_50_skip_30' }])
        .reply(200, [{ artist_mbid: artistMbid, similar_artists: [] }]);

      const result = await client.getSimilarArtists(artistMbid, 10);

      expect(result).toEqual([]);
    });

    it('returns empty array on error response', async() => {
      const artistMbid = 'abc-123-def-456';

      nock('https://labs.api.listenbrainz.org')
        .post('/similar-artists/json', [{ artist_mbids: [artistMbid], algorithm: 'session_based_days_9000_session_300_contribution_5_threshold_15_limit_50_skip_30' }])
        .reply(200, [{ artist_mbid: artistMbid, error: 'Artist not found' }]);

      const result = await client.getSimilarArtists(artistMbid, 10);

      expect(result).toEqual([]);
    });

    it('returns empty array on API error', async() => {
      const artistMbid = 'abc-123-def-456';

      nock('https://labs.api.listenbrainz.org')
        .post('/similar-artists/json', [{ artist_mbids: [artistMbid], algorithm: 'session_based_days_9000_session_300_contribution_5_threshold_15_limit_50_skip_30' }])
        .reply(500);

      const result = await client.getSimilarArtists(artistMbid, 10);

      expect(result).toEqual([]);
    });
  });

  describe('isTransientError', () => {
    it('identifies ECONNRESET as transient', () => {
      const error = Object.assign(new Error('socket hang up'), {
        isAxiosError: true,
        code:         'ECONNRESET',
        response:     undefined,
        config:       {},
        toJSON:       () => ({}),
      });

      expect(isTransientError(error)).toBe(true);
    });

    it('identifies TLS errors as transient', () => {
      const error = Object.assign(new Error('TLS connection failed'), {
        isAxiosError: true,
        code:         'ERR_TLS_CERT_ALTNAME_INVALID',
        response:     undefined,
        config:       {},
        toJSON:       () => ({}),
      });

      expect(isTransientError(error)).toBe(true);
    });

    it('does not treat HTTP 500 as transient', () => {
      const error = Object.assign(new Error('Request failed'), {
        isAxiosError: true,
        code:         'ERR_BAD_RESPONSE',
        response:     { status: 500, data: {} },
        config:       {},
        toJSON:       () => ({}),
      });

      expect(isTransientError(error)).toBe(false);
    });
  });

  describe('retry behavior', () => {
    const retryClient = new ListenBrainzClient({ baseDelayMs: 0 });

    function networkError(code: string, message: string): Error {
      const err = new Error(message);

      (err as Error & { code: string }).code = code;

      return err;
    }

    it('retries on transient error then succeeds', async() => {
      nock('https://api.listenbrainz.org')
        .get('/1/user/testuser/playlists/createdfor')
        .query({ count: 25 })
        .replyWithError(networkError('ECONNRESET', 'socket hang up'));

      nock('https://api.listenbrainz.org')
        .get('/1/user/testuser/playlists/createdfor')
        .query({ count: 25 })
        .reply(200, {
          count:     1,
          offset:    0,
          playlists: [
            {
              playlist: {
                identifier: 'https://listenbrainz.org/playlist/abc-123',
                title:      'Weekly Exploration for testuser',
                creator:    'listenbrainz',
                date:       '2024-01-15',
                extension:  {},
              },
            },
          ],
        });

      const result = await retryClient.fetchPlaylistsCreatedFor('testuser');

      expect(result).toHaveLength(1);
      expect(result[0].title).toBe('Weekly Exploration for testuser');
    });

    it('throws after exhausting retries on persistent network error', async() => {
      for (let i = 0; i < 3; i++) {
        nock('https://api.listenbrainz.org')
          .get('/1/user/testuser/playlists/createdfor')
          .query({ count: 25 })
          .replyWithError(networkError('ECONNRESET', 'socket hang up'));
      }

      await expect(retryClient.fetchPlaylistsCreatedFor('testuser')).rejects.toThrow('socket hang up');
    });

    it('does not retry on HTTP 4xx/5xx errors', async() => {
      nock('https://api.listenbrainz.org')
        .get('/1/user/testuser/playlists/createdfor')
        .query({ count: 25 })
        .reply(404);

      const result = await retryClient.fetchPlaylistsCreatedFor('testuser');

      expect(result).toEqual([]);
    });

    it('retries fetchRecommendations on transient error', async() => {
      nock('https://api.listenbrainz.org')
        .get('/1/cf/recommendation/user/testuser/recording')
        .query({ count: 100 })
        .replyWithError(networkError('ECONNRESET', 'socket hang up'));

      nock('https://api.listenbrainz.org')
        .get('/1/cf/recommendation/user/testuser/recording')
        .query({ count: 100 })
        .reply(200, { payload: { mbids: [{ recording_mbid: 'rec-1', score: 0.9 }] } });

      const result = await retryClient.fetchRecommendations('testuser', 'token', 100);

      expect(result).toEqual([{ recording_mbid: 'rec-1', score: 0.9 }]);
    });
  });

  describe('extractRecordingMbid', () => {
    it('extracts MBID from valid recording URL', () => {
      const url = 'https://musicbrainz.org/recording/abc-123-def-456';
      const result = ListenBrainzClient.extractRecordingMbid(url);

      expect(result).toBe('abc-123-def-456');
    });

    it('handles URL with trailing slash', () => {
      // This should NOT match since we use $ anchor
      const url = 'https://musicbrainz.org/recording/abc-123/';
      const result = ListenBrainzClient.extractRecordingMbid(url);

      expect(result).toBeNull();
    });

    it('returns null for invalid URL', () => {
      const url = 'https://musicbrainz.org/artist/abc-123';
      const result = ListenBrainzClient.extractRecordingMbid(url);

      expect(result).toBeNull();
    });

    it('returns null for non-URL string', () => {
      const url = 'not-a-url';
      const result = ListenBrainzClient.extractRecordingMbid(url);

      expect(result).toBeNull();
    });
  });
});
