import type { ListenBrainzRecommendation } from '@server/types/listenbrainz';
import type { ListenBrainzSettings } from '@server/config/settings';

import logger from '@server/config/logger';
import { JOB_NAMES } from '@server/constants/jobs';
import { getConfig } from '@server/config/settings';
import { ListenBrainzClient } from '@server/services/clients/ListenBrainzClient';
import { MusicBrainzClient } from '@server/services/clients/MusicBrainzClient';
import { CoverArtArchiveClient } from '@server/services/clients/CoverArtArchiveClient';
import { QueueService } from '@server/services/QueueService';
import ProcessedRecording from '@server/models/ProcessedRecording';
import { isJobCancelled } from '@server/plugins/jobs';

/**
 * Context passed to processing helper functions
 */
interface ProcessingContext {
  mbClient:     MusicBrainzClient;
  coverClient:  CoverArtArchiveClient;
  queueService: QueueService;
  approvalMode: string;
}

/**
 * Result from processing a single recording
 */
interface ProcessingResult {
  added: boolean;
}

/**
 * ListenBrainz Fetch Job
 *
 * Fetches track recommendations from ListenBrainz and processes them:
 * - Track mode: Adds tracks directly
 * - Album mode: Resolves tracks to parent albums for de-duplication
 *
 * Source types:
 * - collaborative: Uses CF recommendation API (requires token)
 * - weekly_playlist: Uses weekly exploration playlists (no auth needed)
 */
export async function listenbrainzFetchJob(): Promise<void> {
  const config = getConfig();
  const lb = config.listenbrainz;

  if (!lb || !lb.username) {
    logger.warn('ListenBrainz username not configured, skipping fetch');

    return;
  }

  let sourceType = lb.source_type; // defaults to 'weekly_playlist'

  // Validate token for collaborative mode
  if (sourceType === 'collaborative' && !lb.token) {
    logger.warn('ListenBrainz token required for collaborative mode, falling back to weekly playlist');

    sourceType = 'weekly_playlist';
  }

  const mode = config.mode || 'album';
  const fetchCount = config.fetch_count || 100;
  const approvalMode = lb.approval_mode || 'manual';
  const minScorePercent = normalizeToPercent(config.min_score) ?? 0;

  logger.info(
    `Fetching ListenBrainz recommendations for ${ lb.username } (source: ${ sourceType }, mode: ${ mode }, approval: ${ approvalMode })`
  );

  const lbClient = new ListenBrainzClient();
  const mbClient = new MusicBrainzClient();
  const coverClient = new CoverArtArchiveClient();
  const queueService = new QueueService();

  // Check for cancellation before starting
  if (isJobCancelled(JOB_NAMES.LB_FETCH)) {
    logger.info('Job cancelled before fetching recommendations');
    throw new Error('Job cancelled');
  }

  // Fetch recordings based on source type
  let recs: ListenBrainzRecommendation[];

  if (sourceType === 'weekly_playlist') {
    recs = await fetchWeeklyPlaylistRecordings(lbClient, lb.username);
  } else {
    recs = await fetchCollaborativeRecordings(lbClient, lb, fetchCount);
  }

  if (recs.length === 0) {
    logger.info('No recommendations received');

    return;
  }

  logger.info(`Got ${ recs.length } track recommendations`);

  // Process recordings through shared logic
  const addedCount = await processRecordings(recs, mode, minScorePercent, {
    mbClient,
    coverClient,
    queueService,
    approvalMode,
  });

  logger.info(`Added ${ addedCount } new items from ListenBrainz`);
}

/**
 * Fetch recordings from collaborative filtering recommendations
 */
async function fetchCollaborativeRecordings(
  client: ListenBrainzClient,
  lb: ListenBrainzSettings,
  fetchCount: number
): Promise<ListenBrainzRecommendation[]> {
  return client.fetchRecommendations(lb.username, lb.token!, fetchCount);
}

/**
 * Fetch recordings from weekly exploration playlist
 */
async function fetchWeeklyPlaylistRecordings(
  client: ListenBrainzClient,
  username: string
): Promise<ListenBrainzRecommendation[]> {
  const weeklyPlaylist = await client.findWeeklyExplorationPlaylist(username);

  if (!weeklyPlaylist) {
    logger.warn(`No weekly exploration playlist found for ${ username }`);

    return [];
  }

  logger.info(`Found weekly exploration playlist: ${ weeklyPlaylist.title }`);

  // Extract playlist MBID from identifier URL
  const playlistMbid = extractPlaylistMbid(weeklyPlaylist.identifier);

  if (!playlistMbid) {
    logger.error(`Could not extract playlist MBID from: ${ weeklyPlaylist.identifier }`);

    return [];
  }

  const playlistResponse = await client.fetchPlaylist(playlistMbid);

  if (!playlistResponse) {
    return [];
  }

  const tracks = playlistResponse.playlist.track || [];
  const recordings: ListenBrainzRecommendation[] = [];

  for (const track of tracks) {
    // Handle both single identifier and array of identifiers
    const identifiers = Array.isArray(track.identifier) ? track.identifier : [track.identifier];

    for (const identifier of identifiers) {
      const recordingMbid = ListenBrainzClient.extractRecordingMbid(identifier);

      if (recordingMbid) {
        recordings.push({
          recording_mbid: recordingMbid,
          score:          undefined, // Weekly playlists don't have scores
        });
        break; // Only need one recording MBID per track
      }
    }
  }

  return recordings;
}

/**
 * Extract playlist MBID from ListenBrainz playlist URL
 * @example "https://listenbrainz.org/playlist/abc-123" -> "abc-123"
 */
function extractPlaylistMbid(identifier: string): string | null {
  const match = identifier.match(/\/playlist\/([a-f0-9-]+)$/i);

  return match ? match[1] : null;
}

/**
 * Process all recommendations, delegating to mode-specific handlers
 */
async function processRecordings(
  recs: ListenBrainzRecommendation[],
  mode: string,
  minScorePercent: number,
  ctx: ProcessingContext
): Promise<number> {
  let addedCount = 0;
  const seenAlbums = new Set<string>();

  for (const rec of recs) {
    if (isJobCancelled(JOB_NAMES.LB_FETCH)) {
      logger.info('Job cancelled during processing');
      throw new Error('Job cancelled');
    }

    const mbid = rec.recording_mbid;
    const scorePercent = normalizeToPercent(rec.score);

    if (scorePercent !== undefined && scorePercent < minScorePercent) {
      continue;
    }

    try {
      const alreadyProcessed = await ProcessedRecording.findOne({ where: { mbid, source: 'listenbrainz' } });

      if (alreadyProcessed) {
        continue;
      }

      // Rate limit: MusicBrainz requests (1 request/second)
      await sleep(1000);

      const result = mode === 'track' ? await processTrackMode(mbid, scorePercent, ctx) : await processAlbumMode(mbid, scorePercent, seenAlbums, ctx);

      if (result.added) {
        addedCount++;
      }
    } catch(error) {
      logger.error(`Error processing recommendation ${ mbid }:`, { error });
    }
  }

  return addedCount;
}

/**
 * Process a recording in track mode - adds tracks directly to queue
 */
async function processTrackMode(
  mbid: string,
  scorePercent: number | undefined,
  ctx: ProcessingContext
): Promise<ProcessingResult> {
  const trackInfo = await ctx.mbClient.resolveRecording(mbid);

  if (!trackInfo) {
    return { added: false };
  }

  const coverUrl = trackInfo.releaseGroupMbid ? ctx.coverClient.getCoverUrl(trackInfo.releaseGroupMbid) : null;

  if (ctx.approvalMode === 'manual') {
    const isPending = await ctx.queueService.isPending(mbid);

    if (isPending) {
      return { added: false };
    }

    await ctx.queueService.addPending({
      artist:   trackInfo.artist,
      title:    trackInfo.title,
      mbid:     trackInfo.mbid,
      type:     'track',
      score:    scorePercent,
      source:   'listenbrainz',
      coverUrl: coverUrl || undefined,
    });

    logger.info(`  ? ${ trackInfo.artist } - ${ trackInfo.title } (pending approval)`);
  } else {
    // Auto mode: add directly to wishlist
    // TODO: Direct wishlist support will be added in Phase 3
    logger.info(`  + ${ trackInfo.artist } - ${ trackInfo.title }`);
  }

  await ProcessedRecording.create({
    mbid,
    source:      'listenbrainz',
    processedAt: new Date(),
  });

  return { added: true };
}

/**
 * Process a recording in album mode - resolves to parent album for de-duplication
 */
async function processAlbumMode(
  mbid: string,
  scorePercent: number | undefined,
  seenAlbums: Set<string>,
  ctx: ProcessingContext
): Promise<ProcessingResult> {
  const albumInfo = await ctx.mbClient.resolveRecordingToAlbum(mbid);

  if (!albumInfo) {
    return { added: false };
  }

  const albumMbid = albumInfo.mbid;

  // Skip if we've already seen this album in this run
  if (seenAlbums.has(albumMbid)) {
    return { added: false };
  }
  seenAlbums.add(albumMbid);

  // Check if we've already processed this album
  const alreadyProcessed = await ProcessedRecording.findOne({ where: { mbid: albumMbid, source: 'listenbrainz' } });

  if (alreadyProcessed) {
    return { added: false };
  }

  // Check if rejected or already pending
  const isRejected = await ctx.queueService.isRejected(albumMbid);

  if (isRejected) {
    return { added: false };
  }

  const isPending = await ctx.queueService.isPending(albumMbid);

  if (isPending) {
    return { added: false };
  }

  const coverUrl = ctx.coverClient.getCoverUrl(albumMbid);

  if (ctx.approvalMode === 'manual') {
    await ctx.queueService.addPending({
      artist:      albumInfo.artist,
      album:       albumInfo.title,
      mbid:        albumMbid,
      type:        'album',
      score:       scorePercent,
      source:      'listenbrainz',
      sourceTrack: albumInfo.trackTitle,
      coverUrl:    coverUrl || undefined,
      year:        albumInfo.year,
    });

    logger.info(`  ? ${ albumInfo.artist } - ${ albumInfo.title } (pending approval)`);
  } else {
    // Auto mode: add directly to wishlist
    // TODO: Direct wishlist support
    logger.info(`  + ${ albumInfo.artist } - ${ albumInfo.title }`);
  }

  await ProcessedRecording.create({
    mbid:        albumMbid,
    source:      'listenbrainz',
    processedAt: new Date(),
  });

  return { added: true };
}

/**
 * Sleep helper for rate limiting
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Normalize scores to a 0-100 percent scale.
 * ListenBrainz typically returns 0-1, but guard against already-percent values.
 */
function normalizeToPercent(score?: number): number | undefined {
  if (score === undefined || score === null) {
    return undefined;
  }

  const asPercent = score <= 1 ? score * 100 : score;

  return Math.round(asPercent * 100) / 100;
}
