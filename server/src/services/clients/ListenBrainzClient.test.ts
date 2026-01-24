import { describe, it, expect, afterEach } from 'vitest';
import nock from 'nock';

import { ListenBrainzClient } from './ListenBrainzClient';

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
