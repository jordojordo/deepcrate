import {
  describe, it, expect, afterEach, vi 
} from 'vitest';

import { MusicBrainzClient } from './MusicBrainzClient';
import { HttpError } from '@server/utils/HttpError';
import { fetchJson } from '@server/utils/httpClient';

vi.mock('@server/utils/httpClient');
vi.mock('@server/config/logger', () => ({
  default: {
    info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn()
  }
}));

describe('MusicBrainzClient', () => {
  const client = new MusicBrainzClient();

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('resolveRecording', () => {
    it('returns artist, title, mbid, and releaseGroupMbid', async() => {
      const recordingMbid = 'test-recording-mbid';
      const releaseGroupMbid = 'test-release-group-mbid';

      vi.mocked(fetchJson).mockResolvedValueOnce({
        data: {
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
        },
        status: 200,
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

      vi.mocked(fetchJson).mockResolvedValueOnce({
        data: {
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
        },
        status: 200,
      });

      const result = await client.resolveRecording(recordingMbid);

      expect(result?.releaseGroupMbid).toBe('album-rg-mbid');
    });

    it('falls back to first release when no Album type exists', async() => {
      const recordingMbid = 'test-recording-mbid';

      vi.mocked(fetchJson).mockResolvedValueOnce({
        data: {
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
        },
        status: 200,
      });

      const result = await client.resolveRecording(recordingMbid);

      expect(result?.releaseGroupMbid).toBe('ep-rg-mbid');
    });

    it('returns undefined releaseGroupMbid when no releases exist', async() => {
      const recordingMbid = 'test-recording-mbid';

      vi.mocked(fetchJson).mockResolvedValueOnce({
        data: {
          'id':            recordingMbid,
          'title':         'Test Track',
          'artist-credit': [{ artist: { name: 'Test Artist' } }],
          'releases':      [],
        },
        status: 200,
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

      vi.mocked(fetchJson).mockRejectedValueOnce(
        new HttpError('HTTP 404: Not Found', 404)
      );

      const result = await client.resolveRecording(recordingMbid);

      expect(result).toBeNull();
    });
  });

  describe('getExpectedTrackCount', () => {
    it('returns track count from a single release', async() => {
      vi.mocked(fetchJson).mockResolvedValueOnce({
        data: {
          releases: [
            { id: 'r1', media: [{ 'track-count': 10 }] },
          ],
        },
        status: 200,
      });

      const result = await client.getExpectedTrackCount('rg-single');

      expect(result).toBe(10);
    });

    it('returns median track count across multiple releases', async() => {
      vi.mocked(fetchJson).mockResolvedValueOnce({
        data: {
          releases: [
            { id: 'r1', media: [{ 'track-count': 10 }] },
            { id: 'r2', media: [{ 'track-count': 10 }] },
            { id: 'r3', media: [{ 'track-count': 15 }] }, // deluxe edition
          ],
        },
        status: 200,
      });

      const result = await client.getExpectedTrackCount('rg-multi');

      expect(result).toBe(10);
    });

    it('returns null when no releases found', async() => {
      vi.mocked(fetchJson).mockResolvedValueOnce({
        data:   { releases: [] },
        status: 200,
      });

      const result = await client.getExpectedTrackCount('rg-empty');

      expect(result).toBeNull();
    });

    it('returns null on API error', async() => {
      vi.mocked(fetchJson).mockRejectedValueOnce(
        new HttpError('HTTP 503: Service Unavailable', 503)
      );

      const result = await client.getExpectedTrackCount('rg-error');

      expect(result).toBeNull();
    });

    it('sums track counts across multi-disc releases', async() => {
      vi.mocked(fetchJson).mockResolvedValueOnce({
        data: {
          releases: [
            { id: 'r1', media: [{ 'track-count': 8 }, { 'track-count': 7 }] },
          ],
        },
        status: 200,
      });

      const result = await client.getExpectedTrackCount('rg-multi-disc');

      expect(result).toBe(15);
    });
  });

  describe('getReleaseGroupTags', () => {
    it('returns tags sorted by count descending with null rating when no votes', async() => {
      vi.mocked(fetchJson).mockResolvedValueOnce({
        data: {
          id:   'rg-tags',
          tags: [
            { name: 'jazz', count: 5 },
            { name: 'electronic', count: 10 },
            { name: 'ambient', count: 3 },
          ],
        },
        status: 200,
      });

      const result = await client.getReleaseGroupTags('rg-tags');

      expect(result).toEqual({ tags: ['electronic', 'jazz', 'ambient'], rating: null });
    });

    it('returns rating value when votes exist', async() => {
      vi.mocked(fetchJson).mockResolvedValueOnce({
        data: {
          id:     'rg-rated',
          tags:   [{ name: 'rock', count: 2 }],
          rating: { 'votes-count': 15, value: 4.2 },
        },
        status: 200,
      });

      const result = await client.getReleaseGroupTags('rg-rated');

      expect(result).toEqual({ tags: ['rock'], rating: 4.2 });
    });

    it('returns null rating when votes-count is 0', async() => {
      vi.mocked(fetchJson).mockResolvedValueOnce({
        data: {
          id:     'rg-no-votes',
          tags:   [],
          rating: { 'votes-count': 0, value: null },
        },
        status: 200,
      });

      const result = await client.getReleaseGroupTags('rg-no-votes');

      expect(result).toEqual({ tags: [], rating: null });
    });

    it('filters out tags with count < 1', async() => {
      vi.mocked(fetchJson).mockResolvedValueOnce({
        data: {
          id:   'rg-tags-filter',
          tags: [
            { name: 'rock', count: 3 },
            { name: 'noise', count: 0 },
          ],
        },
        status: 200,
      });

      const result = await client.getReleaseGroupTags('rg-tags-filter');

      expect(result.tags).toEqual(['rock']);
    });

    it('returns empty tags and null rating when no data exists', async() => {
      vi.mocked(fetchJson).mockResolvedValueOnce({
        data:   { id: 'rg-no-tags' },
        status: 200,
      });

      const result = await client.getReleaseGroupTags('rg-no-tags');

      expect(result).toEqual({ tags: [], rating: null });
    });

    it('returns empty tags and null rating on API error', async() => {
      vi.mocked(fetchJson).mockRejectedValueOnce(
        new HttpError('HTTP 404: Not Found', 404)
      );

      const result = await client.getReleaseGroupTags('rg-tags-error');

      expect(result).toEqual({ tags: [], rating: null });
    });
  });
});
