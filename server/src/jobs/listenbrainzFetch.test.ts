import type { ListenBrainzRecordingMetadata } from '@server/types/listenbrainz';

import {
  describe, it, expect, beforeEach, afterEach, vi
} from 'vitest';

import { listenbrainzFetchJob } from './listenbrainzFetch';
import { getConfig } from '@server/config/settings';
import { ListenBrainzClient } from '@server/services/clients/ListenBrainzClient';
import { MusicBrainzClient } from '@server/services/clients/MusicBrainzClient';
import ProcessedRecording from '@server/models/ProcessedRecording';

const queue = vi.hoisted(() => ({
  isRejected: vi.fn(),
  isPending:  vi.fn(),
  addPending: vi.fn(),
}));

vi.mock('@server/config/settings', () => ({ getConfig: vi.fn() }));
vi.mock('@server/config/logger', () => ({
  default: {
    info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn()
  }
}));
vi.mock('@server/config/db', () => ({ withDbWrite: (fn: () => unknown) => fn() }));
vi.mock('@server/plugins/jobs', () => ({ isJobCancelled: () => false }));
vi.mock('@server/models/ProcessedRecording', () => ({ default: { findOne: vi.fn(), create: vi.fn() } }));
vi.mock('@server/services/QueueService', () => ({
  QueueService: class {
    isRejected = queue.isRejected;
    isPending = queue.isPending;
    addPending = queue.addPending;
  },
}));

/** ListenBrainz batch metadata entry for a recording on the given release group. */
function lbEntry(releaseGroupMbid: string, releaseName: string): ListenBrainzRecordingMetadata {
  return {
    artist:    { name: 'Artist', artists: [{ name: 'Artist' }] },
    recording: { name: 'Track' },
    release:   {
      name: releaseName, mbid: `rel-${ releaseGroupMbid }`, release_group_mbid: releaseGroupMbid, year: 2001
    },
  };
}

function setConfig(overrides: { mode?: 'album' | 'track'; preferStudioAlbums?: boolean } = {}) {
  vi.mocked(getConfig).mockReturnValue({
    mode:         overrides.mode ?? 'album',
    fetch_count:  100,
    min_score:    0,
    listenbrainz: {
      username:             'user',
      token:                'token',
      approval_mode:        'manual',
      source_type:          'collaborative',
      prefer_studio_albums: overrides.preferStudioAlbums ?? false,
    },
    scoring:           { musicbrainz_ratings: false },
    catalog_discovery: {},
  } as unknown as ReturnType<typeof getConfig>);
}

describe('listenbrainzFetchJob', () => {
  let getMetadata: ReturnType<typeof vi.spyOn>;
  let resolveToAlbum: ReturnType<typeof vi.spyOn>;
  let resolveRecording: ReturnType<typeof vi.spyOn>;
  let getTags: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.spyOn(ListenBrainzClient.prototype, 'fetchRecommendations').mockResolvedValue([
      { recording_mbid: 'rec-1', score: 0.9 },
    ]);
    getMetadata = vi.spyOn(ListenBrainzClient.prototype, 'getRecordingMetadata')
      .mockResolvedValue(new Map([['rec-1', lbEntry('rg-lb', 'LB Pick')]]));
    resolveToAlbum = vi.spyOn(MusicBrainzClient.prototype, 'resolveRecordingToAlbum').mockResolvedValue({
      artist: 'Artist', title: 'Studio Album', mbid: 'rg-studio', recordingMbid: 'rec-1', trackTitle: 'Track'
    });
    resolveRecording = vi.spyOn(MusicBrainzClient.prototype, 'resolveRecording').mockResolvedValue(null);
    getTags = vi.spyOn(MusicBrainzClient.prototype, 'getReleaseGroupTags').mockResolvedValue({
      tags: ['rock'], rating: null, primaryType: 'Album', secondaryTypes: []
    });

    vi.mocked(ProcessedRecording.findOne).mockResolvedValue(null);
    queue.isRejected.mockResolvedValue(false);
    queue.isPending.mockResolvedValue(false);
    queue.addPending.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  describe('album mode (default)', () => {
    beforeEach(() => setConfig());

    it('queues the release ListenBrainz chose without a MusicBrainz recording lookup', async() => {
      await listenbrainzFetchJob();

      expect(getMetadata).toHaveBeenCalledWith(['rec-1']);
      expect(resolveToAlbum).not.toHaveBeenCalled();
      expect(queue.addPending).toHaveBeenCalledWith(expect.objectContaining({
        album: 'LB Pick', mbid: 'rg-lb', year: 2001, genres: ['rock'],
      }));
    });

    it('falls back to MusicBrainz for recordings ListenBrainz does not know', async() => {
      getMetadata.mockResolvedValue(new Map());

      await listenbrainzFetchJob();

      expect(resolveToAlbum).toHaveBeenCalledWith('rec-1');
      expect(queue.addPending).toHaveBeenCalledWith(expect.objectContaining({ mbid: 'rg-studio' }));
    });

    it('leaves already-processed recordings out of the batch request', async() => {
      vi.spyOn(ListenBrainzClient.prototype, 'fetchRecommendations').mockResolvedValue([
        { recording_mbid: 'rec-done', score: 0.9 },
        { recording_mbid: 'rec-1', score: 0.9 },
        { recording_mbid: 'rec-1', score: 0.9 },
      ]);
      vi.mocked(ProcessedRecording.findOne).mockImplementation((async(options: { where: { mbid: string } }) => (
        options.where.mbid === 'rec-done' ? { mbid: 'rec-done' } : null
      )) as never);

      await listenbrainzFetchJob();

      expect(getMetadata).toHaveBeenCalledWith(['rec-1']);
    });
  });

  describe('album mode with prefer_studio_albums', () => {
    beforeEach(() => setConfig({ preferStudioAlbums: true }));

    it('swaps a compilation pick for the MusicBrainz studio album', async() => {
      getTags.mockResolvedValueOnce({
        tags: [], rating: null, primaryType: 'Album', secondaryTypes: ['Compilation']
      });

      await listenbrainzFetchJob();

      expect(getTags).toHaveBeenNthCalledWith(1, 'rg-lb');
      expect(resolveToAlbum).toHaveBeenCalledWith('rec-1');
      // Genres come from the album actually queued, not the compilation.
      expect(getTags).toHaveBeenNthCalledWith(2, 'rg-studio');
      expect(queue.addPending).toHaveBeenCalledWith(expect.objectContaining({ album: 'Studio Album', mbid: 'rg-studio' }));
    });

    it('swaps a single pick too', async() => {
      getTags.mockResolvedValueOnce({
        tags: [], rating: null, primaryType: 'Single', secondaryTypes: []
      });

      await listenbrainzFetchJob();

      expect(queue.addPending).toHaveBeenCalledWith(expect.objectContaining({ mbid: 'rg-studio' }));
    });

    it('keeps a studio album pick and reuses its release-group lookup', async() => {
      await listenbrainzFetchJob();

      expect(resolveToAlbum).not.toHaveBeenCalled();
      expect(getTags).toHaveBeenCalledTimes(1);
      expect(queue.addPending).toHaveBeenCalledWith(expect.objectContaining({ mbid: 'rg-lb', genres: ['rock'] }));
    });

    it('keeps the ListenBrainz pick when the type lookup failed', async() => {
      // Unknown type: don't spend another request that would likely fail too.
      getTags.mockResolvedValueOnce({ tags: [], rating: null });

      await listenbrainzFetchJob();

      expect(resolveToAlbum).not.toHaveBeenCalled();
      expect(queue.addPending).toHaveBeenCalledWith(expect.objectContaining({ mbid: 'rg-lb' }));
    });
  });

  describe('track mode', () => {
    beforeEach(() => setConfig({ mode: 'track' }));

    it('takes artist and title from batch metadata', async() => {
      await listenbrainzFetchJob();

      expect(resolveRecording).not.toHaveBeenCalled();
      expect(queue.addPending).toHaveBeenCalledWith(expect.objectContaining({
        artist: 'Artist', title: 'Track', mbid: 'rec-1', type: 'track',
      }));
    });
  });
});
