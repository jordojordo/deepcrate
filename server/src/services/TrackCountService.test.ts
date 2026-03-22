import {
  describe, it, expect, afterEach, vi 
} from 'vitest';

import { TrackCountService } from './TrackCountService';
import { HttpError } from '@server/utils/HttpError';
import { fetchJson } from '@server/utils/httpClient';

vi.mock('@server/utils/httpClient');
vi.mock('@server/config/logger', () => ({
  default: {
    info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn()
  }
}));

describe('TrackCountService', () => {
  const service = new TrackCountService();

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns MusicBrainz track count when mbid is available', async() => {
    vi.mocked(fetchJson).mockResolvedValueOnce({
      data: {
        releases: [
          { id: 'r1', media: [{ 'track-count': 12 }] },
        ],
      },
      status: 200,
    });

    const result = await service.resolveExpectedTrackCount({
      mbid:   'test-mbid',
      artist: 'Artist',
      album:  'Album',
    });

    expect(result).toBe(12);
  });

  it('falls back to Deezer when MusicBrainz fails', async() => {
    // MusicBrainz returns no releases
    vi.mocked(fetchJson).mockResolvedValueOnce({
      data:   { releases: [] },
      status: 200,
    });

    // Deezer album search
    vi.mocked(fetchJson).mockResolvedValueOnce({
      data:   { data: [{ id: 1, nb_tracks: 10 }] },
      status: 200,
    });

    const result = await service.resolveExpectedTrackCount({
      mbid:   'bad-mbid',
      artist: 'Artist',
      album:  'Album',
    });

    expect(result).toBe(10);
  });

  it('falls back to Deezer when no mbid is provided', async() => {
    vi.mocked(fetchJson).mockResolvedValueOnce({
      data:   { data: [{ id: 1, nb_tracks: 8 }] },
      status: 200,
    });

    const result = await service.resolveExpectedTrackCount({
      artist: 'Artist',
      album:  'Album',
    });

    expect(result).toBe(8);
  });

  it('returns null when both sources fail', async() => {
    // MusicBrainz fails
    vi.mocked(fetchJson).mockRejectedValueOnce(
      new HttpError('HTTP 503: Service Unavailable', 503)
    );

    // Deezer exact search - empty
    vi.mocked(fetchJson).mockResolvedValueOnce({
      data:   { data: [] },
      status: 200,
    });

    // Deezer loose search - empty
    vi.mocked(fetchJson).mockResolvedValueOnce({
      data:   { data: [] },
      status: 200,
    });

    const result = await service.resolveExpectedTrackCount({
      mbid:   'test-mbid',
      artist: 'Artist',
      album:  'Album',
    });

    expect(result).toBeNull();
  });
});
