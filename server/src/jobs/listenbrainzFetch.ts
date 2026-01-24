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
  const addedCount = await processRecordings(recs, mode, approvalMode, minScorePercent);

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
 * Process recordings and add to queue
 */
async function processRecordings(
  recs: ListenBrainzRecommendation[],
  mode: string,
  approvalMode: string,
  minScorePercent: number
): Promise<number> {
  const mbClient = new MusicBrainzClient();
  const coverClient = new CoverArtArchiveClient();
  const queueService = new QueueService();

  let addedCount = 0;
  const seenAlbums = new Set<string>(); // For album mode de-duplication within this run

  for (const rec of recs) {
    // Check for cancellation at each iteration
    if (isJobCancelled(JOB_NAMES.LB_FETCH)) {
      logger.info('Job cancelled during processing');
      throw new Error('Job cancelled');
    }

    const mbid = rec.recording_mbid;
    const score = rec.score;
    const scorePercent = normalizeToPercent(score);

    if (scorePercent !== undefined && scorePercent < minScorePercent) {
      continue;
    }

    try {
      // Check if we've already processed this recording
      const alreadyProcessed = await ProcessedRecording.findOne({ where: { mbid, source: 'listenbrainz' } });

      if (alreadyProcessed) {
        continue;
      }

      // Rate limit: MusicBrainz requests (1 request/second)
      await sleep(1000);

      if (mode === 'track') {
        // Track mode: resolve recording to track
        const trackInfo = await mbClient.resolveRecording(mbid);

        if (!trackInfo) {
          continue;
        }

        // Get cover art URL if we have a release-group MBID
        const coverUrl = trackInfo.releaseGroupMbid ? coverClient.getCoverUrl(trackInfo.releaseGroupMbid) : null;

        // Add to queue
        if (approvalMode === 'manual') {
          // Check if already in pending queue
          const isPending = await queueService.isPending(mbid);

          if (isPending) {
            continue;
          }

          await queueService.addPending({
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

        // Mark as processed
        await ProcessedRecording.create({
          mbid,
          source:      'listenbrainz',
          processedAt: new Date(),
        });

        addedCount++;
      } else {
        // Album mode: resolve recording to album
        const albumInfo = await mbClient.resolveRecordingToAlbum(mbid);

        if (!albumInfo) {
          continue;
        }

        const albumMbid = albumInfo.mbid;

        // Skip if we've already seen this album in this run
        if (seenAlbums.has(albumMbid)) {
          continue;
        }
        seenAlbums.add(albumMbid);

        // Check if we've already processed this album
        const alreadyProcessedAlbum = await ProcessedRecording.findOne({ where: { mbid: albumMbid, source: 'listenbrainz' } });

        if (alreadyProcessedAlbum) {
          continue;
        }

        // Check if rejected
        const isRejected = await queueService.isRejected(albumMbid);

        if (isRejected) {
          continue;
        }

        // Check if already in pending queue
        const isPending = await queueService.isPending(albumMbid);

        if (isPending) {
          continue;
        }

        // Get cover art URL
        const coverUrl = coverClient.getCoverUrl(albumMbid);

        // Add to queue
        if (approvalMode === 'manual') {
          await queueService.addPending({
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

        // Mark recording as processed (so we don't reprocess the same tracks from this album)
        await ProcessedRecording.create({
          mbid:        albumMbid,
          source:      'listenbrainz',
          processedAt: new Date(),
        });

        addedCount++;
      }
    } catch(error) {
      logger.error(`Error processing recommendation ${ mbid }:`, { error });
    }
  }

  return addedCount;
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
