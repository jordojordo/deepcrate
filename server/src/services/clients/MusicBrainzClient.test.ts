import { describe, it, expect, afterEach } from 'vitest';
import nock from 'nock';

import { MusicBrainzClient } from './MusicBrainzClient';

describe('MusicBrainzClient', () => {
  const client = new MusicBrainzClient();

  afterEach(() => {
    nock.cleanAll();
  });

  describe('resolveRecording', () => {
    it('returns artist, title, mbid, and releaseGroupMbid', async() => {
      const recordingMbid = 'test-recording-mbid';
      const releaseGroupMbid = 'test-release-group-mbid';

      nock('https://musicbrainz.org')
        .get(`/ws/2/recording/${ recordingMbid }`)
        .query({ inc: 'artists+releases+release-groups', fmt: 'json' })
        .reply(200, {
          'id':            recordingMbid,
          'title':         'Test Track',
          'artist-credit': [{ artist: { name: 'Test Artist' } }],
          'releases':      [
            {
              'id':            'release-1',
              'release-group': {
                'id':           releaseGroupMbid,
                'title':        'Test Album',
                'primary-type': 'Album',
              },
            },
          ],
        });

      const result = await client.resolveRecording(recordingMbid);

      expect(result).toEqual({
        artist:           'Test Artist',
        title:            'Test Track',
        mbid:             recordingMbid,
        releaseGroupMbid: releaseGroupMbid,
      });
    });

    it('prefers Album type over other release types', async() => {
      const recordingMbid = 'test-recording-mbid';

      nock('https://musicbrainz.org')
        .get(`/ws/2/recording/${ recordingMbid }`)
        .query({ inc: 'artists+releases+release-groups', fmt: 'json' })
        .reply(200, {
          'id':            recordingMbid,
          'title':         'Test Track',
          'artist-credit': [{ artist: { name: 'Test Artist' } }],
          'releases':      [
            {
              'id':            'single-release',
              'release-group': {
                'id':           'single-rg-mbid',
                'title':        'Test Single',
                'primary-type': 'Single',
              },
            },
            {
              'id':            'album-release',
              'release-group': {
                'id':           'album-rg-mbid',
                'title':        'Test Album',
                'primary-type': 'Album',
              },
            },
          ],
        });

      const result = await client.resolveRecording(recordingMbid);

      expect(result?.releaseGroupMbid).toBe('album-rg-mbid');
    });

    it('falls back to first release when no Album type exists', async() => {
      const recordingMbid = 'test-recording-mbid';

      nock('https://musicbrainz.org')
        .get(`/ws/2/recording/${ recordingMbid }`)
        .query({ inc: 'artists+releases+release-groups', fmt: 'json' })
        .reply(200, {
          'id':            recordingMbid,
          'title':         'Test Track',
          'artist-credit': [{ artist: { name: 'Test Artist' } }],
          'releases':      [
            {
              'id':            'ep-release',
              'release-group': {
                'id':           'ep-rg-mbid',
                'title':        'Test EP',
                'primary-type': 'EP',
              },
            },
          ],
        });

      const result = await client.resolveRecording(recordingMbid);

      expect(result?.releaseGroupMbid).toBe('ep-rg-mbid');
    });

    it('returns undefined releaseGroupMbid when no releases exist', async() => {
      const recordingMbid = 'test-recording-mbid';

      nock('https://musicbrainz.org')
        .get(`/ws/2/recording/${ recordingMbid }`)
        .query({ inc: 'artists+releases+release-groups', fmt: 'json' })
        .reply(200, {
          'id':            recordingMbid,
          'title':         'Test Track',
          'artist-credit': [{ artist: { name: 'Test Artist' } }],
          'releases':      [],
        });

      const result = await client.resolveRecording(recordingMbid);

      expect(result).toEqual({
        artist:           'Test Artist',
        title:            'Test Track',
        mbid:             recordingMbid,
        releaseGroupMbid: undefined,
      });
    });

    it('returns null on API error', async() => {
      const recordingMbid = 'test-recording-mbid';

      nock('https://musicbrainz.org')
        .get(`/ws/2/recording/${ recordingMbid }`)
        .query({ inc: 'artists+releases+release-groups', fmt: 'json' })
        .reply(404);

      const result = await client.resolveRecording(recordingMbid);

      expect(result).toBeNull();
    });
  });

  describe('getExpectedTrackCount', () => {
    it('returns track count from a single release', async() => {
      const mbid = 'rg-single';

      nock('https://musicbrainz.org')
        .get('/ws/2/release')
        .query({
          'release-group': mbid, status: 'official', limit: '5', fmt: 'json' 
        })
        .reply(200, {
          releases: [
            { id: 'r1', media: [{ 'track-count': 10 }] },
          ],
        });

      const result = await client.getExpectedTrackCount(mbid);

      expect(result).toBe(10);
    });

    it('returns median track count across multiple releases', async() => {
      const mbid = 'rg-multi';

      nock('https://musicbrainz.org')
        .get('/ws/2/release')
        .query({
          'release-group': mbid, status: 'official', limit: '5', fmt: 'json' 
        })
        .reply(200, {
          releases: [
            { id: 'r1', media: [{ 'track-count': 10 }] },
            { id: 'r2', media: [{ 'track-count': 10 }] },
            { id: 'r3', media: [{ 'track-count': 15 }] }, // deluxe edition
          ],
        });

      const result = await client.getExpectedTrackCount(mbid);

      expect(result).toBe(10);
    });

    it('returns null when no releases found', async() => {
      const mbid = 'rg-empty';

      nock('https://musicbrainz.org')
        .get('/ws/2/release')
        .query({
          'release-group': mbid, status: 'official', limit: '5', fmt: 'json' 
        })
        .reply(200, { releases: [] });

      const result = await client.getExpectedTrackCount(mbid);

      expect(result).toBeNull();
    });

    it('returns null on API error', async() => {
      const mbid = 'rg-error';

      nock('https://musicbrainz.org')
        .get('/ws/2/release')
        .query({
          'release-group': mbid, status: 'official', limit: '5', fmt: 'json' 
        })
        .reply(503);

      const result = await client.getExpectedTrackCount(mbid);

      expect(result).toBeNull();
    });

    it('sums track counts across multi-disc releases', async() => {
      const mbid = 'rg-multi-disc';

      nock('https://musicbrainz.org')
        .get('/ws/2/release')
        .query({
          'release-group': mbid, status: 'official', limit: '5', fmt: 'json' 
        })
        .reply(200, {
          releases: [
            { id: 'r1', media: [{ 'track-count': 8 }, { 'track-count': 7 }] },
          ],
        });

      const result = await client.getExpectedTrackCount(mbid);

      expect(result).toBe(15);
    });
  });

  describe('getReleaseGroupTags', () => {
    it('returns tags sorted by count descending with null rating when no votes', async() => {
      const mbid = 'rg-tags';

      nock('https://musicbrainz.org')
        .get(`/ws/2/release-group/${ mbid }`)
        .query({ inc: 'tags+ratings', fmt: 'json' })
        .reply(200, {
          id:   mbid,
          tags: [
            { name: 'jazz', count: 5 },
            { name: 'electronic', count: 10 },
            { name: 'ambient', count: 3 },
          ],
        });

      const result = await client.getReleaseGroupTags(mbid);

      expect(result).toEqual({ tags: ['electronic', 'jazz', 'ambient'], rating: null });
    });

    it('returns rating value when votes exist', async() => {
      const mbid = 'rg-rated';

      nock('https://musicbrainz.org')
        .get(`/ws/2/release-group/${ mbid }`)
        .query({ inc: 'tags+ratings', fmt: 'json' })
        .reply(200, {
          id:     mbid,
          tags:   [{ name: 'rock', count: 2 }],
          rating: { 'votes-count': 15, value: 4.2 },
        });

      const result = await client.getReleaseGroupTags(mbid);

      expect(result).toEqual({ tags: ['rock'], rating: 4.2 });
    });

    it('returns null rating when votes-count is 0', async() => {
      const mbid = 'rg-no-votes';

      nock('https://musicbrainz.org')
        .get(`/ws/2/release-group/${ mbid }`)
        .query({ inc: 'tags+ratings', fmt: 'json' })
        .reply(200, {
          id:     mbid,
          tags:   [],
          rating: { 'votes-count': 0, value: null },
        });

      const result = await client.getReleaseGroupTags(mbid);

      expect(result).toEqual({ tags: [], rating: null });
    });

    it('filters out tags with count < 1', async() => {
      const mbid = 'rg-tags-filter';

      nock('https://musicbrainz.org')
        .get(`/ws/2/release-group/${ mbid }`)
        .query({ inc: 'tags+ratings', fmt: 'json' })
        .reply(200, {
          id:   mbid,
          tags: [
            { name: 'rock', count: 3 },
            { name: 'noise', count: 0 },
          ],
        });

      const result = await client.getReleaseGroupTags(mbid);

      expect(result.tags).toEqual(['rock']);
    });

    it('returns empty tags and null rating when no data exists', async() => {
      const mbid = 'rg-no-tags';

      nock('https://musicbrainz.org')
        .get(`/ws/2/release-group/${ mbid }`)
        .query({ inc: 'tags+ratings', fmt: 'json' })
        .reply(200, { id: mbid });

      const result = await client.getReleaseGroupTags(mbid);

      expect(result).toEqual({ tags: [], rating: null });
    });

    it('returns empty tags and null rating on API error', async() => {
      const mbid = 'rg-tags-error';

      nock('https://musicbrainz.org')
        .get(`/ws/2/release-group/${ mbid }`)
        .query({ inc: 'tags+ratings', fmt: 'json' })
        .reply(404);

      const result = await client.getReleaseGroupTags(mbid);

      expect(result).toEqual({ tags: [], rating: null });
    });
  });
});
