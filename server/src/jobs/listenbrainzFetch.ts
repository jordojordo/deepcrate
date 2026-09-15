import type { ListenBrainzRecommendation, ListenBrainzRecordingMetadata } from '@server/types/listenbrainz';
import type { AlbumInfo, RecordingInfo, ReleaseGroupTagsInfo } from '@server/types/musicbrainz';
import type { ListenBrainzSettings } from '@server/config/schemas';

import logger from '@server/config/logger';
import { JOB_NAMES } from '@server/constants/jobs';
import { getConfig } from '@server/config/settings';
import { withDbWrite } from '@server/config/db';
import { ListenBrainzClient } from '@server/services/clients/ListenBrainzClient';
import { MusicBrainzClient } from '@server/services/clients/MusicBrainzClient';
import { LastFmClient } from '@server/services/clients/LastFmClient';
import { CoverArtArchiveClient } from '@server/services/clients/CoverArtArchiveClient';
import { QueueService } from '@server/services/QueueService';
import ProcessedRecording from '@server/models/ProcessedRecording';
import { isJobCancelled } from '@server/plugins/jobs';

/**
 * Context passed to processing helper functions
 */
interface ProcessingContext {
  lbClient:           ListenBrainzClient;
  mbClient:           MusicBrainzClient;
  coverClient:        CoverArtArchiveClient;
  queueService:       QueueService;
  approvalMode:       string;
  lastFmClient?:      LastFmClient;
  applyRatingBonus:   boolean;
  preferStudioAlbums: boolean;
  metadata:           Map<string, ListenBrainzRecordingMetadata>;
}

interface Candidate {
  mbid:          string;
  scorePercent?: number;
}

interface ResolvedAlbum {
  album:    AlbumInfo;
  details?: ReleaseGroupTagsInfo;
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
  const lastFmClient = config.catalog_discovery?.lastfm?.api_key ? new LastFmClient(config.catalog_discovery.lastfm.api_key) : undefined;
  const applyRatingBonus = config.scoring?.musicbrainz_ratings ?? true;

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
    lbClient,
    mbClient,
    coverClient,
    queueService,
    approvalMode,
    lastFmClient,
    applyRatingBonus,
    preferStudioAlbums: lb.prefer_studio_albums ?? false,
    metadata:           new Map(),
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
  let weeklyPlaylist;

  try {
    weeklyPlaylist = await client.findWeeklyExplorationPlaylist(username);
  } catch(error) {
    logger.error(`Could not reach ListenBrainz API after retries: ${ (error as Error).message }`);

    return [];
  }

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
  const candidates = await selectCandidates(recs, minScorePercent);

  if (candidates.length === 0) {
    return 0;
  }

  const batchCtx: ProcessingContext = {
    ...ctx,
    metadata: await ctx.lbClient.getRecordingMetadata(candidates.map((c) => c.mbid)),
  };

  logger.debug(`ListenBrainz metadata resolved ${ batchCtx.metadata.size }/${ candidates.length } recordings; the rest fall back to MusicBrainz`);

  for (const { mbid, scorePercent } of candidates) {
    if (isJobCancelled(JOB_NAMES.LB_FETCH)) {
      logger.info('Job cancelled during processing');
      throw new Error('Job cancelled');
    }

    try {
      const result = mode === 'track' ? await processTrackMode(mbid, scorePercent, batchCtx) : await processAlbumMode(mbid, scorePercent, seenAlbums, batchCtx);

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
 * Drop recommendations below the score threshold, already processed in an
 * earlier run, or repeated within this one.
 */
async function selectCandidates(recs: ListenBrainzRecommendation[], minScorePercent: number): Promise<Candidate[]> {
  const candidates: Candidate[] = [];
  const seen = new Set<string>();

  for (const rec of recs) {
    const mbid = rec.recording_mbid;
    const scorePercent = normalizeToPercent(rec.score);

    if (seen.has(mbid) || (scorePercent !== undefined && scorePercent < minScorePercent)) {
      continue;
    }
    seen.add(mbid);

    try {
      const alreadyProcessed = await ProcessedRecording.findOne({ where: { mbid, source: 'listenbrainz' } });

      if (!alreadyProcessed) {
        candidates.push({ mbid, scorePercent });
      }
    } catch(error) {
      logger.error(`Error checking processed state for ${ mbid }:`, { error });
    }
  }

  return candidates;
}

/**
 * Resolve a recording's artist/title from batch metadata, or MusicBrainz if
 * ListenBrainz didn't know it.
 */
async function resolveTrack(mbid: string, ctx: ProcessingContext): Promise<RecordingInfo | null> {
  const metadata = ctx.metadata.get(mbid);
  const fromBatch = metadata ? ListenBrainzClient.toRecordingInfo(mbid, metadata) : null;

  return fromBatch ?? ctx.mbClient.resolveRecording(mbid);
}

/**
 * Pick the album a recording should be queued under.
 *
 * By default this is the release ListenBrainz chose, with no MusicBrainz call.
 * With prefer_studio_albums, that pick is checked against MusicBrainz and a
 * single/EP/compilation is swapped for MusicBrainzClient's choice, which
 * prefers the artist's own album.
 */
async function resolveAlbum(mbid: string, ctx: ProcessingContext): Promise<ResolvedAlbum | null> {
  const metadata = ctx.metadata.get(mbid);
  const lbAlbum = metadata ? ListenBrainzClient.toAlbumInfo(mbid, metadata) : null;

  if (!lbAlbum) {
    const mbAlbum = await ctx.mbClient.resolveRecordingToAlbum(mbid);

    return mbAlbum ? { album: mbAlbum } : null;
  }

  if (!ctx.preferStudioAlbums) {
    return { album: lbAlbum };
  }

  const details = await ctx.mbClient.getReleaseGroupTags(lbAlbum.mbid);

  if (!isNonStudioRelease(details)) {
    return { album: lbAlbum, details };
  }

  const mbAlbum = await ctx.mbClient.resolveRecordingToAlbum(mbid);

  // Same release group (the recording only exists on singles, say) or a failed
  // lookup: keep ListenBrainz's pick and the details we already have.
  if (!mbAlbum || mbAlbum.mbid === lbAlbum.mbid) {
    return { album: lbAlbum, details };
  }

  return { album: mbAlbum };
}

function isNonStudioRelease(details: ReleaseGroupTagsInfo): boolean {
  if (details.primaryType === undefined) {
    return false;
  }

  return details.primaryType !== 'Album' || (details.secondaryTypes ?? []).includes('Compilation');
}

/**
 * Process a recording in track mode - adds tracks directly to queue
 */
async function processTrackMode(
  mbid: string,
  scorePercent: number | undefined,
  ctx: ProcessingContext
): Promise<ProcessingResult> {
  const trackInfo = await resolveTrack(mbid, ctx);

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

  await withDbWrite(() => ProcessedRecording.create({
    mbid,
    source:      'listenbrainz',
    processedAt: new Date(),
  }));

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
  const resolved = await resolveAlbum(mbid, ctx);

  if (!resolved) {
    return { added: false };
  }

  const albumInfo = resolved.album;

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

  const { tags: mbTags, rating } = resolved.details ?? await ctx.mbClient.getReleaseGroupTags(albumMbid);

  // Fetch Last.fm artist tags and merge with MB tags
  const mergedGenres: string[] = [...mbTags];

  if (ctx.lastFmClient) {
    const lastFmTags = await ctx.lastFmClient.getArtistTopTags(albumInfo.artist);
    const lastFmTagNames = lastFmTags.map((t) => t.name);

    for (const tag of lastFmTagNames) {
      if (!mergedGenres.includes(tag)) {
        mergedGenres.push(tag);
      }
    }
  }

  // Apply MusicBrainz rating bonus if enabled
  let adjustedScore = scorePercent;

  if (ctx.applyRatingBonus && rating !== null && adjustedScore !== undefined) {
    adjustedScore = Math.min(100, adjustedScore * (1 + 0.15 * (rating / 5)));
    adjustedScore = Math.round(adjustedScore * 100) / 100;
  }

  if (ctx.approvalMode === 'manual') {
    await ctx.queueService.addPending({
      artist:      albumInfo.artist,
      album:       albumInfo.title,
      mbid:        albumMbid,
      type:        'album',
      score:       adjustedScore,
      source:      'listenbrainz',
      sourceTrack: albumInfo.trackTitle,
      coverUrl:    coverUrl || undefined,
      year:        albumInfo.year,
      genres:      mergedGenres.length > 0 ? mergedGenres : undefined,
    });

    logger.info(`  ? ${ albumInfo.artist } - ${ albumInfo.title } (pending approval)`);
  } else {
    // Auto mode: add directly to wishlist
    // TODO: Direct wishlist support
    logger.info(`  + ${ albumInfo.artist } - ${ albumInfo.title }`);
  }

  await withDbWrite(() => ProcessedRecording.create({
    mbid:        albumMbid,
    source:      'listenbrainz',
    processedAt: new Date(),
  }));

  return { added: true };
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
