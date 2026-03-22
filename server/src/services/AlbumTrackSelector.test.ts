import {
  describe, it, expect, beforeEach, afterEach, vi
} from 'vitest';

// Mock the config module before importing AlbumTrackSelector
vi.mock('@server/config/settings', () => ({
  getConfig: () => ({
    preview: {
      enabled: true,
      spotify: {
        enabled:       false,
        client_id:     '',
        client_secret: '',
      },
    },
  }),
  getDataPath: () => '/tmp',
}));

// Mock the logger to avoid file system operations
vi.mock('@server/config/logger', () => ({
  default: {
    debug: vi.fn(),
    info:  vi.fn(),
    warn:  vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('@server/utils/httpClient');

import { AlbumTrackSelector } from './AlbumTrackSelector';
import { fetchJson } from '@server/utils/httpClient';

describe('AlbumTrackSelector', () => {
  let selector: AlbumTrackSelector;

  beforeEach(() => {
    vi.clearAllMocks();
    selector = new AlbumTrackSelector();
  });

  afterEach(() => {
    selector.clearCache();
  });

  describe('selectTrack', () => {
    it('uses sourceTrack when provided', async() => {
      const result = await selector.selectTrack({
        artist:      'Dream Theater',
        album:       'Images and Words',
        sourceTrack: 'Pull Me Under',
      });

      expect(result).not.toBeNull();
      expect(result!.title).toBe('Pull Me Under');
      expect(result!.artist).toBe('Dream Theater');
      expect(result!.previewUrl).toBeNull();
      expect(result!.source).toBe('musicbrainz');
    });

    it('selects track from Deezer when sourceTrack not provided', async() => {
      // Mock Deezer album search
      vi.mocked(fetchJson).mockResolvedValueOnce({
        data: {
          data:  [{
            id: 12345, title: 'Images and Words', artist: { id: 1, name: 'Dream Theater' }
          }],
          total: 1,
        },
        status: 200,
      });

      // Mock Deezer album tracks
      vi.mocked(fetchJson).mockResolvedValueOnce({
        data: {
          data: [
            {
              id: 1, title: 'Pull Me Under', preview: 'https://deezer.com/preview/1', artist: { id: 1, name: 'Dream Theater' }, duration: 300, track_position: 1
            },
            {
              id: 2, title: 'Another Day', preview: 'https://deezer.com/preview/2', artist: { id: 1, name: 'Dream Theater' }, duration: 240, track_position: 2
            },
          ],
          total: 2,
        },
        status: 200,
      });

      const result = await selector.selectTrack({
        artist: 'Dream Theater',
        album:  'Images and Words',
      });

      expect(result).not.toBeNull();
      expect(result!.title).toBe('Pull Me Under');
      expect(result!.artist).toBe('Dream Theater');
      expect(result!.previewUrl).toBe('https://deezer.com/preview/1');
      expect(result!.source).toBe('deezer');
    });

    it('falls back to MusicBrainz when Deezer fails', async() => {
      // Mock Deezer album search - not found (exact)
      vi.mocked(fetchJson).mockResolvedValueOnce({
        data:   { data: [], total: 0 },
        status: 200,
      });

      // Mock Deezer album search - not found (loose)
      vi.mocked(fetchJson).mockResolvedValueOnce({
        data:   { data: [], total: 0 },
        status: 200,
      });

      // Mock MusicBrainz release lookup
      vi.mocked(fetchJson).mockResolvedValueOnce({
        data:   { releases: [{ id: 'release-id' }] },
        status: 200,
      });

      // Mock MusicBrainz release tracks
      vi.mocked(fetchJson).mockResolvedValueOnce({
        data: {
          media: [{
            tracks: [
              { title: 'Hidden Gem', position: 1 },
              { title: 'Another Track', position: 2 },
            ],
          }],
        },
        status: 200,
      });

      const result = await selector.selectTrack({
        artist: 'Obscure Artist',
        album:  'Rare Album',
        mbid:   'abc123-mbid',
      });

      expect(result).not.toBeNull();
      expect(result!.title).toBe('Hidden Gem');
      expect(result!.source).toBe('musicbrainz');
      expect(result!.previewUrl).toBeNull();
    });

    it('returns null when no track is found', async() => {
      // Mock Deezer album search - not found (exact)
      vi.mocked(fetchJson).mockResolvedValueOnce({
        data:   { data: [], total: 0 },
        status: 200,
      });

      // Mock Deezer album search - not found (loose)
      vi.mocked(fetchJson).mockResolvedValueOnce({
        data:   { data: [], total: 0 },
        status: 200,
      });

      const result = await selector.selectTrack({
        artist: 'Unknown Artist',
        album:  'Unknown Album',
      });

      expect(result).toBeNull();
    });

    it('caches results', async() => {
      // Mock Deezer album search
      vi.mocked(fetchJson).mockResolvedValueOnce({
        data: {
          data:  [{
            id: 99999, title: 'Cached Album', artist: { id: 1, name: 'Cached Artist' }
          }],
          total: 1,
        },
        status: 200,
      });

      // Mock Deezer album tracks
      vi.mocked(fetchJson).mockResolvedValueOnce({
        data: {
          data: [
            {
              id: 1, title: 'Cached Track', preview: 'https://deezer.com/cached', artist: { id: 1, name: 'Cached Artist' }, duration: 200, track_position: 1
            },
          ],
          total: 1,
        },
        status: 200,
      });

      // First call
      const result1 = await selector.selectTrack({
        artist: 'Cached Artist',
        album:  'Cached Album',
      });

      // Second call (should be cached)
      const result2 = await selector.selectTrack({
        artist: 'Cached Artist',
        album:  'Cached Album',
      });

      expect(result1).toEqual(result2);
      // Only 2 fetchJson calls (album search + tracks), not 4
      expect(fetchJson).toHaveBeenCalledTimes(2);
    });
  });

  describe('clearCache', () => {
    it('clears the cache', async() => {
      // First call with sourceTrack
      await selector.selectTrack({
        artist:      'Test',
        album:       'Test Album',
        sourceTrack: 'Track 1',
      });

      selector.clearCache();

      // After clearing, new call should work
      const result = await selector.selectTrack({
        artist:      'Test',
        album:       'Test Album',
        sourceTrack: 'Track 2',
      });

      expect(result!.title).toBe('Track 2');
    });
  });
});
