import { describe, it, expect, afterEach } from 'vitest';
import nock from 'nock';

import { TrackCountService } from './TrackCountService';

describe('TrackCountService', () => {
  const service = new TrackCountService();

  afterEach(() => {
    nock.cleanAll();
  });

  it('returns MusicBrainz track count when mbid is available', async() => {
    nock('https://musicbrainz.org')
      .get('/ws/2/release')
      .query({
        'release-group': 'test-mbid', status: 'official', limit: '5', fmt: 'json' 
      })
      .reply(200, {
        releases: [
          { id: 'r1', media: [{ 'track-count': 12 }] },
        ],
      });

    const result = await service.resolveExpectedTrackCount({
      mbid:   'test-mbid',
      artist: 'Artist',
      album:  'Album',
    });

    expect(result).toBe(12);
  });

  it('falls back to Deezer when MusicBrainz fails', async() => {
    nock('https://musicbrainz.org')
      .get('/ws/2/release')
      .query({
        'release-group': 'bad-mbid', status: 'official', limit: '5', fmt: 'json' 
      })
      .reply(200, { releases: [] });

    nock('https://api.deezer.com')
      .get('/search/album')
      .query({ q: 'artist:"Artist" album:"Album"' })
      .reply(200, { data: [{ id: 1, nb_tracks: 10 }] });

    const result = await service.resolveExpectedTrackCount({
      mbid:   'bad-mbid',
      artist: 'Artist',
      album:  'Album',
    });

    expect(result).toBe(10);
  });

  it('falls back to Deezer when no mbid is provided', async() => {
    nock('https://api.deezer.com')
      .get('/search/album')
      .query({ q: 'artist:"Artist" album:"Album"' })
      .reply(200, { data: [{ id: 1, nb_tracks: 8 }] });

    const result = await service.resolveExpectedTrackCount({
      artist: 'Artist',
      album:  'Album',
    });

    expect(result).toBe(8);
  });

  it('returns null when both sources fail', async() => {
    nock('https://musicbrainz.org')
      .get('/ws/2/release')
      .query({
        'release-group': 'test-mbid', status: 'official', limit: '5', fmt: 'json' 
      })
      .reply(503);

    nock('https://api.deezer.com')
      .get('/search/album')
      .query({ q: 'artist:"Artist" album:"Album"' })
      .reply(200, { data: [] });

    nock('https://api.deezer.com')
      .get('/search/album')
      .query({ q: 'Artist Album' })
      .reply(200, { data: [] });

    const result = await service.resolveExpectedTrackCount({
      mbid:   'test-mbid',
      artist: 'Artist',
      album:  'Album',
    });

    expect(result).toBeNull();
  });
});
