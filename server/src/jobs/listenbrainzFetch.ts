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
 */
export async function listenbrainzFetchJob(): Promise<void> {
  const config = getConfig();
  const lb = config.listenbrainz;

  if (!lb || !lb.username || !lb.token) {
    logger.warn('ListenBrainz not configured, skipping fetch');

    return;
  }

  const mode = config.mode || 'album';
  const fetchCount = config.fetch_count || 100;
  const approvalMode = lb.approval_mode || 'manual';

  logger.info(`Fetching ListenBrainz recommendations for ${ lb.username } (mode: ${ mode }, approval: ${ approvalMode })`);

  const lbClient = new ListenBrainzClient();
  const mbClient = new MusicBrainzClient();
  const coverClient = new CoverArtArchiveClient();
  const queueService = new QueueService();

  // Check for cancellation before starting
  if (isJobCancelled(JOB_NAMES.LB_FETCH)) {
    logger.info('Job cancelled before fetching recommendations');
    throw new Error('Job cancelled');
  }

  // Fetch recommendations
  const recs = await lbClient.fetchRecommendations(lb.username, lb.token, fetchCount);

  if (recs.length === 0) {
    logger.info('No recommendations received');

    return;
  }

  logger.info(`Got ${ recs.length } track recommendations`);

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

        // Add to queue
        if (approvalMode === 'manual') {
          // Check if already in pending queue
          const isPending = await queueService.isPending(mbid);

          if (isPending) {
            continue;
          }

          await queueService.addPending({
            artist: trackInfo.artist,
            title:  trackInfo.title,
            mbid:   trackInfo.mbid,
            type:   'track',
            score:  score ? Math.round(score * 100) / 100 : undefined,
            source: 'listenbrainz',
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
            score:       score ? Math.round(score * 100) / 100 : undefined,
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

  logger.info(`Added ${ addedCount } new items from ListenBrainz`);
}

/**
 * Sleep helper for rate limiting
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
