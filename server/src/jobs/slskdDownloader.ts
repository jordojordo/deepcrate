import type {
  SearchConfig,
  SearchAttemptResult,
  FileSelectionOptions,
  QualityPreferences,
  SearchPendingSelectionResult,
} from '@server/types/slskd';
import type { SlskdFile, SlskdSearchResponse } from '@server/types/slskd-client';
import type { QueryContext } from '@server/types/search-query';

import path from 'path';

import { Op } from '@sequelize/core';
import logger from '@server/config/logger';
import { getConfig, SlskdSearchSettings } from '@server/config/settings';
import DownloadTask from '@server/models/DownloadTask';
import WishlistItem from '@server/models/WishlistItem';
import { DownloadService } from '@server/services/DownloadService';
import { WishlistService } from '@server/services/WishlistService';
import { SearchQueryBuilder } from '@server/services/SearchQueryBuilder';
import { SlskdClient } from '@server/services/clients/SlskdClient';
import { isJobCancelled } from '@server/plugins/jobs';

import { JOB_NAMES } from '@server/constants/jobs';
import {
  SEARCH_TIMEOUT_MS,
  SEARCH_POLL_INTERVAL_MS,
  SEARCH_MAX_WAIT_MS,
  MIN_FILES_ALBUM,
  MIN_FILES_TRACK,
  MB_TO_BYTES,
  MUSIC_EXTENSIONS,
  QUALITY_SCORES,
  DEFAULT_PREFERRED_FORMATS,
  MAX_STORED_SELECTION_RESULTS,
} from '@server/constants/slskd';
import {
  extractQualityInfo,
  calculateAverageQualityScore,
  shouldRejectFile,
  getDominantQualityInfo,
} from '@server/utils/audioQuality';

/**
 * Build SearchConfig from configuration settings.
 */
function buildSearchConfig(
  searchSettings?: SlskdSearchSettings,
  selectionSettings?: { mode?: 'auto' | 'manual'; timeout_hours?: number },
  legacyTimeout?: number,
  legacyMinTracks?: number
): SearchConfig {
  const s = searchSettings;
  const qp = s?.quality_preferences;

  return {
    queryBuilder: new SearchQueryBuilder({
      albumQueryTemplate: s?.album_query_template ?? '{artist} - {album}',
      trackQueryTemplate: s?.track_query_template ?? '{artist} - {title}',
      fallbackQueries:    s?.fallback_queries ?? [],
      excludeTerms:       s?.exclude_terms ?? [],
    }),
    searchTimeoutMs:      s?.search_timeout_ms ?? legacyTimeout ?? SEARCH_TIMEOUT_MS,
    maxWaitMs:            s?.max_wait_ms ?? SEARCH_MAX_WAIT_MS,
    minResponseFiles:     s?.min_response_files ?? legacyMinTracks ?? MIN_FILES_ALBUM,
    maxResponsesToEval:   s?.max_responses_to_evaluate ?? 50,
    minFileSizeBytes:     (s?.min_file_size_mb ?? 1) * MB_TO_BYTES,
    maxFileSizeBytes:     (s?.max_file_size_mb ?? 500) * MB_TO_BYTES,
    preferCompleteAlbums: s?.prefer_complete_albums ?? true,
    preferAlbumFolder:    s?.prefer_album_folder ?? true,
    retryEnabled:         s?.retry?.enabled ?? false,
    maxRetryAttempts:     s?.retry?.max_attempts ?? 3,
    simplifyOnRetry:      s?.retry?.simplify_on_retry ?? true,
    retryDelayMs:         s?.retry?.delay_between_retries_ms ?? 5000,
    qualityPreferences:   qp ? {
      enabled:          qp.enabled ?? true,
      preferredFormats: qp.preferred_formats ?? [...DEFAULT_PREFERRED_FORMATS],
      minBitrate:       qp.min_bitrate ?? 256,
      preferLossless:   qp.prefer_lossless ?? true,
      rejectLowQuality: qp.reject_low_quality ?? false,
      rejectLossless:   qp.reject_lossless ?? false,
    } : undefined,
    selection: {
      mode:         selectionSettings?.mode ?? 'auto',
      timeoutHours: selectionSettings?.timeout_hours ?? 24,
    },
  };
}

/**
 * slskd Downloader Job
 *
 * Reads the wishlist.txt file and sends download requests to slskd.
 * Tracks downloaded items to avoid re-submitting the same searches.
 */
export async function slskdDownloaderJob(): Promise<void> {
  const config = getConfig();
  const slskdConfig = config.slskd;

  if (!slskdConfig || !slskdConfig.host || !slskdConfig.api_key) {
    logger.debug('slskd not configured, skipping downloader');

    return;
  }

  logger.info('Starting slskd downloader job');

  const slskdClient = new SlskdClient(slskdConfig.host, slskdConfig.api_key, slskdConfig.url_base);
  const downloadService = new DownloadService();
  const wishlistService = new WishlistService();
  const searchConfig = buildSearchConfig(
    slskdConfig.search,
    slskdConfig.selection,
    slskdConfig.search_timeout,
    slskdConfig.min_album_tracks
  );

  try {
    if (isJobCancelled(JOB_NAMES.SLSKD)) {
      logger.info('Job cancelled before processing wishlist');
      throw new Error('Job cancelled');
    }

    // 1) Create download tasks for new wishlist items.
    //    Note: WishlistItem.processedAt indicates the item has a DownloadTask record.
    const unprocessedWishlistItems = await wishlistService.getUnprocessed();

    if (unprocessedWishlistItems.length === 0) {
      logger.debug('No unprocessed wishlist items');
    } else {
      for (const wishlistItem of unprocessedWishlistItems) {
        if (isJobCancelled(JOB_NAMES.SLSKD)) {
          logger.info('Job cancelled during wishlist task creation');
          throw new Error('Job cancelled');
        }

        const wishlistKey = buildWishlistKey(wishlistItem.artist, wishlistItem.album);

        try {
          const task = await findOrCreateTask(wishlistItem, wishlistKey);

          // Backfill FK in case an older task exists without linkage.
          if (!task.wishlistItemId) {
            await task.update({ wishlistItemId: wishlistItem.id });
          }

          await wishlistService.markProcessed(wishlistItem.id);
        } catch(error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          const errorStack = error instanceof Error ? error.stack : undefined;

          logger.error(`Failed to create download task for wishlist entry ${ wishlistKey }: ${ errorMessage }`, { stack: errorStack });
        }
      }
    }

    // 2) Process any pending/deferred search tasks, regardless of WishlistItem.processedAt.
    const tasksToProcess = await loadProcessableTasks();

    let queuedCount = 0;
    let skippedCount = 0;
    let failedCount = 0;
    let pendingSelectionCount = 0;

    for (const task of tasksToProcess) {
      if (isJobCancelled(JOB_NAMES.SLSKD)) {
        logger.info('Job cancelled during processing');
        throw new Error('Job cancelled');
      }

      try {
        if (shouldSkipTask(task)) {
          skippedCount++;
          continue;
        }

        const processed = await processDownloadTask({
          task,
          wishlistKey: task.wishlistKey,
          slskdClient,
          downloadService,
          searchConfig,
        });

        if (processed === 'queued') {
          queuedCount++;
        } else if (processed === 'failed') {
          failedCount++;
        } else if (processed === 'pending_selection') {
          pendingSelectionCount++;
        }
      } catch(error) {
        failedCount++;
        const errorMessage = error instanceof Error ? error.message : String(error);
        const errorStack = error instanceof Error ? error.stack : undefined;

        logger.error(`Failed to process download task ${ task.wishlistKey }: ${ errorMessage }`, { stack: errorStack });
      }
    }

    // Process expired selections
    const expiredCount = await downloadService.processExpiredSelections();

    if (expiredCount > 0) {
      logger.info(`Processed ${ expiredCount } expired selection(s)`);
    }

    const transfers = await slskdClient.getDownloads();

    await downloadService.syncTaskStatusesFromTransfers(transfers);

    const parts = [`${ queuedCount } queued`];

    if (pendingSelectionCount > 0) {
      parts.push(`${ pendingSelectionCount } pending selection`);
    }

    parts.push(`${ skippedCount } skipped`, `${ failedCount } failed`);
    logger.info(`slskd downloader completed (${ parts.join(', ') })`);
  } catch(error) {
    logger.error('slskd downloader job failed:', { error });
    throw error;
  }
}

async function loadProcessableTasks(): Promise<DownloadTask[]> {
  return DownloadTask.findAll({
    where: { status: { [Op.in]: ['pending', 'searching', 'deferred'] } },
    order: [['queuedAt', 'ASC']],
  });
}

function shouldSkipTask(task: DownloadTask): boolean {
  if (task.status === 'completed') {
    logger.debug(`Skipping completed download task: ${ task.wishlistKey }`);

    return true;
  }

  if (task.status === 'queued' || task.status === 'downloading') {
    logger.debug(`Skipping active download task: ${ task.wishlistKey } (${ task.status })`);

    return true;
  }

  if (task.status === 'failed') {
    logger.debug(`Skipping failed download task (awaiting retry): ${ task.wishlistKey }`);

    return true;
  }

  return false;
}

async function findOrCreateTask(wishlistItem: WishlistItem, wishlistKey: string): Promise<DownloadTask> {
  const [task] = await DownloadTask.findOrCreate({
    where:    { wishlistKey },
    defaults: {
      wishlistKey,
      wishlistItemId: wishlistItem.id,
      artist:         wishlistItem.artist,
      album:          wishlistItem.album,
      type:           wishlistItem.type,
      status:         'pending',
      retryCount:     0,
      queuedAt:       new Date(),
      year:           wishlistItem.year ?? undefined,
    },
  });

  return task;
}

async function processDownloadTask(params: {
  task:            DownloadTask;
  wishlistKey:     string;
  slskdClient:     SlskdClient;
  downloadService: DownloadService;
  searchConfig:    SearchConfig;
}): Promise<'queued' | 'failed' | 'skipped' | 'deferred' | 'pending_selection'> {
  const {
    task, wishlistKey, slskdClient, downloadService, searchConfig
  } = params;

  // Build query context from the task (wishlist item may have been processed/removed).
  const queryContext: QueryContext = {
    artist: task.artist,
    album:  task.type === 'album' ? task.album : undefined,
    title:  task.type === 'track' ? task.album : undefined,
    year:   task.year ?? undefined,
    type:   task.type,
  };

  const minFiles = task.type === 'track' ? MIN_FILES_TRACK : searchConfig.minResponseFiles;

  // Try to find usable results, with retry logic if enabled
  const searchResult = await executeSearchWithRetry({
    queryContext,
    wishlistKey,
    task,
    slskdClient,
    downloadService,
    searchConfig,
    minFiles,
  });

  if (searchResult.status === 'deferred') {
    return 'deferred';
  }

  if (searchResult.status === 'pending_selection') {
    return 'pending_selection';
  }

  if (searchResult.status === 'failed') {
    return 'failed';
  }

  const { response, searchId, selection } = searchResult;

  if (selection.files.length < response.files.length) {
    logger.debug(`Selected ${ selection.files.length }/${ response.files.length } files for ${ wishlistKey } from ${ response.username }`);
  }

  const enqueueResult = await slskdClient.enqueue(response.username, selection.files);

  if (!enqueueResult) {
    await downloadService.updateTaskStatus(task.id, 'failed', {
      slskdSearchId: searchId,
      errorMessage:  'Failed to enqueue downloads in slskd',
    });

    await slskdClient.deleteSearch(searchId);

    return 'failed';
  }

  if (enqueueResult.enqueued.length === 0) {
    await downloadService.updateTaskStatus(task.id, 'failed', {
      slskdSearchId: searchId,
      errorMessage:  `slskd rejected all ${ selection.files.length } files`,
    });

    await slskdClient.deleteSearch(searchId);

    return 'failed';
  }

  const fileIds = enqueueResult.enqueued.map(f => f.id).filter((id): id is string => typeof id === 'string');

  // Extract dominant quality info from selected files
  const qualityInfo = getDominantQualityInfo(selection.files);

  await downloadService.updateTaskStatus(task.id, 'queued', {
    slskdSearchId:     searchId,
    slskdUsername:     response.username,
    slskdDirectory:    selection.directory,
    slskdFileIds:      fileIds.length > 0 ? fileIds : undefined,
    fileCount:         enqueueResult.enqueued.length,
    qualityFormat:     qualityInfo?.format,
    qualityBitRate:    qualityInfo?.bitRate ?? undefined,
    qualityBitDepth:   qualityInfo?.bitDepth ?? undefined,
    qualitySampleRate: qualityInfo?.sampleRate ?? undefined,
    qualityTier:       qualityInfo?.tier,
    errorMessage:      undefined,
  });

  await slskdClient.deleteSearch(searchId);

  const qualityDesc = qualityInfo ? `${ qualityInfo.format }/${ qualityInfo.tier }` : 'unknown';

  logger.info(`Queued download: ${ wishlistKey } (${ response.username }, ${ enqueueResult.enqueued.length } files, ${ qualityDesc })`);

  return 'queued';
}

/**
 * Execute search with retry logic.
 * Tries primary query, then fallback queries if retry is enabled.
 */
async function executeSearchWithRetry(params: {
  queryContext:    QueryContext;
  wishlistKey:     string;
  task:            DownloadTask;
  slskdClient:     SlskdClient;
  downloadService: DownloadService;
  searchConfig:    SearchConfig;
  minFiles:        number;
}): Promise<SearchAttemptResult> {
  const {
    queryContext, wishlistKey, task, slskdClient, downloadService, searchConfig, minFiles
  } = params;
  const {
    queryBuilder, retryEnabled, maxRetryAttempts, simplifyOnRetry, retryDelayMs
  } = searchConfig;

  // Try primary query first
  const primaryQuery = queryBuilder.buildQuery(queryContext);
  const primaryResult = await attemptSearch({
    query: primaryQuery,
    wishlistKey,
    task,
    slskdClient,
    downloadService,
    searchConfig,
    minFiles,
  });

  if (primaryResult.status === 'success' || primaryResult.status === 'deferred' || primaryResult.status === 'pending_selection') {
    return primaryResult;
  }

  // If retry not enabled, return the failure
  if (!retryEnabled) {
    return primaryResult;
  }

  // Retry with fallback queries
  for (let attempt = 0; attempt < maxRetryAttempts - 1; attempt++) {
    if (isJobCancelled(JOB_NAMES.SLSKD)) {
      throw new Error('Job cancelled');
    }

    const fallbackQuery = queryBuilder.buildFallbackQuery(queryContext, attempt, simplifyOnRetry);

    if (!fallbackQuery) {
      // No more fallbacks available
      break;
    }

    logger.debug(`Retry ${ attempt + 1 } for ${ wishlistKey }: "${ fallbackQuery }"`);

    // Wait before retry
    await sleep(retryDelayMs);

    const retryResult = await attemptSearch({
      query: fallbackQuery,
      wishlistKey,
      task,
      slskdClient,
      downloadService,
      searchConfig,
      minFiles,
    });

    if (retryResult.status === 'success' || retryResult.status === 'deferred' || retryResult.status === 'pending_selection') {
      return retryResult;
    }
  }

  // All retries exhausted
  await downloadService.updateTaskStatus(task.id, 'failed', { errorMessage: `No results after ${ maxRetryAttempts } search attempts` });

  return { status: 'failed' };
}

/**
 * Attempt a single search query.
 */
async function attemptSearch(params: {
  query:           string;
  wishlistKey:     string;
  task:            DownloadTask;
  slskdClient:     SlskdClient;
  downloadService: DownloadService;
  searchConfig:    SearchConfig;
  minFiles:        number;
}): Promise<SearchAttemptResult> {
  const {
    query, wishlistKey, task, slskdClient, downloadService, searchConfig, minFiles
  } = params;
  const {
    searchTimeoutMs, maxWaitMs, maxResponsesToEval, minFileSizeBytes, maxFileSizeBytes, preferCompleteAlbums, preferAlbumFolder, qualityPreferences, selection
  } = searchConfig;

  // Reuse existing search if task was deferred (timed out) or is still searching
  let searchId = (task.status === 'searching' || task.status === 'deferred') ? task.slskdSearchId || null : null;

  if (!searchId) {
    logger.debug(`Starting slskd search for "${ query }"`);
    searchId = await slskdClient.search(query, searchTimeoutMs, minFiles);

    if (!searchId) {
      await downloadService.updateTaskStatus(task.id, 'failed', { errorMessage: 'Failed to start slskd search' });

      return { status: 'failed' };
    }
  }

  await downloadService.updateTaskStatus(task.id, 'searching', {
    slskdSearchId: searchId,
    errorMessage:  undefined,
  });

  const searchState = await waitForSearchCompletion(slskdClient, searchId, maxWaitMs);

  logger.debug(`slskd search ${ searchId } for ${ wishlistKey } returned state ${ searchState }`);

  if (searchState === 'TimedOut') {
    logger.info(`Search still in progress for ${ wishlistKey }, will retry later`);
    await downloadService.updateTaskStatus(task.id, 'deferred', {
      slskdSearchId: searchId,
      errorMessage:  undefined,
    });

    return { status: 'deferred' };
  }

  if (searchState !== 'Completed') {
    await downloadService.updateTaskStatus(task.id, 'failed', {
      slskdSearchId: searchId,
      errorMessage:  `Search ${ searchState.toLowerCase() }`,
    });

    await slskdClient.deleteSearch(searchId);

    return { status: 'failed' };
  }

  const responses = await slskdClient.getSearchResponses(searchId);

  if (responses.length === 0) {
    await slskdClient.deleteSearch(searchId);

    // Don't update task status here, let the caller handle it for retry logic
    return { status: 'failed' };
  }

  // In manual selection mode, store the results and wait for user selection
  if (selection.mode === 'manual') {
    // Calculate selection expiration time
    let selectionExpiresAt: Date | undefined;

    if (selection.timeoutHours > 0) {
      selectionExpiresAt = new Date(Date.now() + selection.timeoutHours * 60 * 60 * 1000);
    }

    // Store the search results in the database (limited to reduce memory usage)
    const storedResultsLimit = Math.min(maxResponsesToEval, MAX_STORED_SELECTION_RESULTS);

    await DownloadTask.update(
      {
        status:             'pending_selection',
        searchResults:      JSON.stringify(responses.slice(0, storedResultsLimit)),
        searchQuery:        query,
        selectionExpiresAt,
        slskdSearchId:      searchId,
        errorMessage:       undefined,
      },
      { where: { id: task.id } }
    );

    // Emit WebSocket event
    const { emitDownloadPendingSelection } = await import('@server/plugins/io/namespaces/downloadsNamespace');

    emitDownloadPendingSelection({
      id:                 task.id,
      artist:             task.artist,
      album:              task.album,
      resultCount:        Math.min(responses.length, storedResultsLimit),
      selectionExpiresAt: selectionExpiresAt ?? null,
    });

    logger.info(`Manual selection required for ${ wishlistKey } (${ responses.length } results)`);

    return {
      status:      'pending_selection',
      responses:   responses.slice(0, storedResultsLimit),
      searchId,
      searchQuery: query,
    } as SearchPendingSelectionResult;
  }

  // Auto mode: pick the best response automatically
  const response = pickBestResponse(responses, maxResponsesToEval, minFileSizeBytes, maxFileSizeBytes, qualityPreferences);

  if (!response) {
    await slskdClient.deleteSearch(searchId);

    return { status: 'failed' };
  }

  const fileSelection = selectDownloadFiles(response, {
    minFileSizeBytes,
    maxFileSizeBytes,
    preferCompleteAlbums,
    preferAlbumFolder,
    minFiles,
  });

  if (!fileSelection || fileSelection.files.length === 0) {
    await slskdClient.deleteSearch(searchId);

    return { status: 'failed' };
  }

  return {
    status:    'success',
    response,
    searchId,
    selection: fileSelection,
  };
}

function buildWishlistKey(artist: string, title: string): string {
  return `${ artist } - ${ title }`;
}

function normalizeSlskdPath(value: string): string {
  const normalized = value.replace(/\\/g, '/').replace(/\/+$/, '');

  return normalized === '.' ? '' : normalized;
}

function isMusicFile(filename: string): boolean {
  const ext = path.extname(filename).toLowerCase();

  return MUSIC_EXTENSIONS.includes(ext);
}

function pickBestResponse(
  responses: SlskdSearchResponse[],
  maxToEvaluate: number,
  minFileSizeBytes: number,
  maxFileSizeBytes: number,
  qualityPreferences?: QualityPreferences,
): SlskdSearchResponse | null {
  // Limit responses to evaluate for performance
  const toEvaluate = responses.slice(0, maxToEvaluate);

  const scored = toEvaluate
    .map((response) => {
      // Count only music files within size constraints for scoring
      let musicFiles = response.files.filter((f) => {
        if (!isMusicFile(f.filename)) {
          return false;
        }

        const size = f.size || 0;

        // Filter by size constraints
        if (minFileSizeBytes > 0 && size < minFileSizeBytes) {
          return false;
        }

        if (maxFileSizeBytes > 0 && size > maxFileSizeBytes) {
          return false;
        }

        return true;
      });

      // Apply quality rejection filter if enabled
      if (qualityPreferences?.enabled && qualityPreferences.rejectLowQuality) {
        musicFiles = musicFiles.filter((f) => {
          const qualityInfo = extractQualityInfo(f);

          return !shouldRejectFile(qualityInfo, qualityPreferences);
        });
      }

      // Calculate quality score
      const qualityScore = qualityPreferences?.enabled ? calculateAverageQualityScore(musicFiles, qualityPreferences) : QUALITY_SCORES.unknown;

      return {
        response,
        musicFiles,
        musicFileCount: musicFiles.length,
        qualityScore,
        totalSize:      musicFiles.reduce((sum, file) => sum + (file.size || 0), 0),
        uploadSpeed:    response.uploadSpeed || 0,
        hasSlot:        response.hasFreeUploadSlot ? 1 : 0,
      };
    })
    .filter(scored => scored.musicFileCount > 0);

  if (scored.length === 0) {
    return null;
  }

  // Sort: hasSlot → qualityScore → musicFileCount → totalSize → uploadSpeed
  scored.sort((a, b) => {
    if (b.hasSlot !== a.hasSlot) {
      return b.hasSlot - a.hasSlot;
    }

    if (b.qualityScore !== a.qualityScore) {
      return b.qualityScore - a.qualityScore;
    }

    if (b.musicFileCount !== a.musicFileCount) {
      return b.musicFileCount - a.musicFileCount;
    }

    if (b.totalSize !== a.totalSize) {
      return b.totalSize - a.totalSize;
    }

    return b.uploadSpeed - a.uploadSpeed;
  });

  return scored[0].response;
}

function selectDownloadFiles(
  response: SlskdSearchResponse,
  options: FileSelectionOptions,
): { directory: string; files: SlskdFile[] } | null {
  const {
    minFileSizeBytes, maxFileSizeBytes, preferCompleteAlbums, preferAlbumFolder, minFiles
  } = options;

  const directoryMap = new Map<string, { files: Map<string, SlskdFile>; totalSize: number }>();

  // Filter to music files within size constraints
  const musicFiles = response.files.filter((f) => {
    if (!f.filename || !isMusicFile(f.filename)) {
      return false;
    }

    const size = f.size || 0;

    if (minFileSizeBytes > 0 && size < minFileSizeBytes) {
      return false;
    }

    if (maxFileSizeBytes > 0 && size > maxFileSizeBytes) {
      return false;
    }

    return true;
  });

  for (const file of musicFiles) {
    const normalizedFilename = normalizeSlskdPath(file.filename);
    const directory = path.posix.dirname(normalizedFilename);

    if (!directoryMap.has(directory)) {
      directoryMap.set(directory, { files: new Map<string, SlskdFile>(), totalSize: 0 });
    }

    const group = directoryMap.get(directory)!;

    if (!group.files.has(file.filename)) {
      group.files.set(file.filename, file);
      group.totalSize += file.size || 0;
    }
  }

  if (directoryMap.size === 0) {
    return null;
  }

  // Score and sort directories
  const scoredGroups = Array.from(directoryMap.entries()).map(([dir, group]) => {
    let score = 0;

    // Base score: +100 per music file
    score += group.files.size * 100;

    // Bonus for album folder structure (contains artist/album-like path)
    if (preferAlbumFolder && hasAlbumFolderStructure(dir)) {
      score += 50;
    }

    // Bonus for meeting minimum track count (complete album indicator)
    if (preferCompleteAlbums && group.files.size >= minFiles) {
      score += 25;
    }

    return {
      directory: dir, group, score
    };
  });

  scoredGroups.sort((a, b) => {
    // Primary: score descending
    if (b.score !== a.score) {
      return b.score - a.score;
    }

    // Secondary: file count descending
    if (b.group.files.size !== a.group.files.size) {
      return b.group.files.size - a.group.files.size;
    }

    // Tertiary: total size descending
    if (b.group.totalSize !== a.group.totalSize) {
      return b.group.totalSize - a.group.totalSize;
    }

    // Final: alphabetical
    return a.directory.localeCompare(b.directory);
  });

  const { directory, group } = scoredGroups[0];
  const files = Array.from(group.files.values());

  return {
    directory,
    files,
  };
}

/**
 * Check if a path looks like an album folder structure (e.g., "Artist/Album" or "Artist - Album").
 */
function hasAlbumFolderStructure(directory: string): boolean {
  // Has at least one directory level
  if (directory.includes('/') && directory.split('/').length >= 2) {
    return true;
  }

  // Contains a separator that suggests "Artist - Album" format
  if (directory.includes(' - ')) {
    return true;
  }

  return false;
}

async function waitForSearchCompletion(
  slskdClient: SlskdClient,
  searchId: string,
  maxWaitMs: number = SEARCH_MAX_WAIT_MS,
): Promise<'Completed' | 'Cancelled' | 'TimedOut' | 'Unknown'> {
  const startTime = Date.now();

  while (Date.now() - startTime < maxWaitMs) {
    if (isJobCancelled(JOB_NAMES.SLSKD)) {
      logger.info('Job cancelled while waiting for search results');
      throw new Error('Job cancelled');
    }

    const state = await slskdClient.getSearchState(searchId);

    if (!state) {
      return 'Unknown';
    }

    if (state.state === 'Completed' || state.state === 'Cancelled') {
      return state.state;
    }

    await sleep(SEARCH_POLL_INTERVAL_MS);
  }

  return 'TimedOut';
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
