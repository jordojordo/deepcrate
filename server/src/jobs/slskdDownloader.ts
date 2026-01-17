import path from 'path';
import { Op } from '@sequelize/core';
import logger from '@server/config/logger';
import { JOB_NAMES } from '@server/constants/jobs';
import { getConfig } from '@server/config/settings';
import DownloadedItem from '@server/models/DownloadedItem';
import DownloadTask from '@server/models/DownloadTask';
import { DownloadService } from '@server/services/DownloadService';
import { WishlistService } from '@server/services/WishlistService';
import {
  SlskdClient,
  SlskdFile,
  SlskdSearchResponse,
} from '@server/services/clients/SlskdClient';
import { isJobCancelled } from '@server/plugins/jobs';

interface WishlistEntry {
  artist: string;
  title:  string;
  type:   'album' | 'track';
}

const SEARCH_TIMEOUT_MS = 15000;
const SEARCH_POLL_INTERVAL_MS = 1000;
const SEARCH_MAX_WAIT_MS = 20000;
const MIN_FILES_ALBUM = 3;
const MIN_FILES_TRACK = 1;

/** Common music file extensions to filter search results */
const MUSIC_EXTENSIONS = ['.mp3', '.flac', '.m4a', '.ogg', '.opus', '.wav', '.aac', '.wma', '.alac'];

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

  const slskdClient = new SlskdClient(slskdConfig.host, slskdConfig.api_key);
  const downloadService = new DownloadService();
  const wishlistService = new WishlistService();

  try {
    if (isJobCancelled(JOB_NAMES.SLSKD)) {
      logger.info('Job cancelled before processing wishlist');
      throw new Error('Job cancelled');
    }

    const entries = wishlistService.readAll();

    if (entries.length === 0) {
      logger.debug('Wishlist is empty');
    }

    const entriesByKey = new Map<string, WishlistEntry>();

    for (const entry of entries) {
      const wishlistKey = buildWishlistKey(entry.artist, entry.title);

      if (!entriesByKey.has(wishlistKey)) {
        entriesByKey.set(wishlistKey, entry);
      }
    }

    const wishlistKeys = Array.from(entriesByKey.keys());
    const tasksByKey = await loadExistingTasks(wishlistKeys);
    const downloadedKeys = await loadDownloadedKeys(wishlistKeys);

    let queuedCount = 0;
    let skippedCount = 0;
    let failedCount = 0;

    for (const [wishlistKey, entry] of entriesByKey.entries()) {
      if (isJobCancelled(JOB_NAMES.SLSKD)) {
        logger.info('Job cancelled during processing');
        throw new Error('Job cancelled');
      }

      try {
        const existingTask = tasksByKey.get(wishlistKey) || null;

        if (existingTask && shouldSkipTask(existingTask)) {
          skippedCount++;
          continue;
        }

        if (!existingTask && downloadedKeys.has(wishlistKey)) {
          logger.debug(`Skipping already-downloaded wishlist entry: ${ wishlistKey }`);
          skippedCount++;
          continue;
        }

        const task = existingTask || await findOrCreateTask(entry, wishlistKey);

        if (!existingTask) {
          tasksByKey.set(wishlistKey, task);
        }

        const processed = await processWishlistEntry({
          entry,
          task,
          wishlistKey,
          slskdClient,
          downloadService,
        });

        if (processed === 'queued') {
          queuedCount++;
        } else if (processed === 'failed') {
          failedCount++;
        }
      } catch(error) {
        failedCount++;
        const errorMessage = error instanceof Error ? error.message : String(error);
        const errorStack = error instanceof Error ? error.stack : undefined;

        logger.error(`Failed to process wishlist entry ${ wishlistKey }: ${ errorMessage }`, { stack: errorStack });
      }
    }

    const transfers = await slskdClient.getDownloads();

    await downloadService.syncTaskStatusesFromTransfers(transfers);

    logger.info(`slskd downloader completed (${ queuedCount } queued, ${ skippedCount } skipped, ${ failedCount } failed)`);
  } catch(error) {
    logger.error('slskd downloader job failed:', { error });
    throw error;
  }
}

async function loadExistingTasks(wishlistKeys: string[]): Promise<Map<string, DownloadTask>> {
  if (wishlistKeys.length === 0) {
    return new Map();
  }

  const tasks = await DownloadTask.findAll({ where: { wishlistKey: { [Op.in]: wishlistKeys } } });

  return new Map(tasks.map(task => [task.wishlistKey, task]));
}

async function loadDownloadedKeys(wishlistKeys: string[]): Promise<Set<string>> {
  if (wishlistKeys.length === 0) {
    return new Set();
  }

  const downloadedItems = await DownloadedItem.findAll({ where: { wishlistKey: { [Op.in]: wishlistKeys } } });

  return new Set(downloadedItems.map(item => item.wishlistKey));
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

async function findOrCreateTask(entry: WishlistEntry, wishlistKey: string): Promise<DownloadTask> {
  const [task] = await DownloadTask.findOrCreate({
    where:    { wishlistKey },
    defaults: {
      wishlistKey,
      artist:     entry.artist,
      album:      entry.title,
      type:       entry.type,
      status:     'pending',
      retryCount: 0,
      queuedAt:   new Date(),
    },
  });

  return task;
}

async function processWishlistEntry(params: {
  entry:           WishlistEntry;
  task:            DownloadTask;
  wishlistKey:     string;
  slskdClient:     SlskdClient;
  downloadService: DownloadService;
}): Promise<'queued' | 'failed' | 'skipped' | 'deferred'> {
  const {
    entry, task, wishlistKey, slskdClient, downloadService
  } = params;
  const query = wishlistKey;
  const minFiles = entry.type === 'track' ? MIN_FILES_TRACK : MIN_FILES_ALBUM;

  // Reuse existing search if task was deferred (timed out) or is still searching
  let searchId = (task.status === 'searching' || task.status === 'deferred') ? task.slskdSearchId || null : null;

  if (!searchId) {
    searchId = await slskdClient.search(query, SEARCH_TIMEOUT_MS, minFiles);

    if (!searchId) {
      await downloadService.updateTaskStatus(task.id, 'failed', { errorMessage: 'Failed to start slskd search' });

      return 'failed';
    }

    logger.debug(`Started slskd search ${ searchId } for ${ wishlistKey }`);
  }

  await downloadService.updateTaskStatus(task.id, 'searching', {
    slskdSearchId: searchId,
    errorMessage:  undefined,
  });

  const searchResult = await waitForSearchCompletion(slskdClient, searchId);

  logger.debug(`slskd search ${ searchId } for ${ wishlistKey } returned state ${ searchResult }`);

  if (searchResult === 'TimedOut') {
    logger.info(`Search still in progress for ${ wishlistKey }, will retry later`);
    await downloadService.updateTaskStatus(task.id, 'deferred', {
      slskdSearchId: searchId,
      errorMessage:  undefined,
    });

    return 'deferred';
  }

  if (searchResult !== 'Completed') {
    await downloadService.updateTaskStatus(task.id, 'failed', {
      slskdSearchId: searchId,
      errorMessage:  `Search ${ searchResult.toLowerCase() }`,
    });

    await slskdClient.deleteSearch(searchId);

    return 'failed';
  }

  const responses = await slskdClient.getSearchResponses(searchId);

  if (responses.length === 0) {
    await downloadService.updateTaskStatus(task.id, 'failed', {
      slskdSearchId: searchId,
      errorMessage:  'No search results from slskd',
    });

    await slskdClient.deleteSearch(searchId);

    return 'failed';
  }

  const response = pickBestResponse(responses);

  if (!response) {
    await downloadService.updateTaskStatus(task.id, 'failed', {
      slskdSearchId: searchId,
      errorMessage:  'No usable search results from slskd',
    });

    await slskdClient.deleteSearch(searchId);

    return 'failed';
  }

  const selection = selectDownloadFiles(response);

  if (!selection || selection.files.length === 0) {
    await downloadService.updateTaskStatus(task.id, 'failed', {
      slskdSearchId: searchId,
      errorMessage:  'Search response contained no files',
    });

    await slskdClient.deleteSearch(searchId);

    return 'failed';
  }

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

  await downloadService.updateTaskStatus(task.id, 'queued', {
    slskdSearchId:  searchId,
    slskdUsername:  response.username,
    slskdDirectory: selection.directory,
    slskdFileIds:   fileIds.length > 0 ? fileIds : undefined,
    fileCount:      enqueueResult.enqueued.length,
    errorMessage:   undefined,
  });

  await slskdClient.deleteSearch(searchId);

  logger.info(`Queued download: ${ wishlistKey } (${ response.username }, ${ enqueueResult.enqueued.length } files)`);

  return 'queued';
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

function pickBestResponse(responses: SlskdSearchResponse[]): SlskdSearchResponse | null {
  const scored = responses
    .map((response) => {
      // Count only music files for scoring
      const musicFiles = response.files.filter(f => isMusicFile(f.filename));

      return {
        response,
        musicFileCount: musicFiles.length,
        totalSize:      musicFiles.reduce((sum, file) => sum + (file.size || 0), 0),
        uploadSpeed:    response.uploadSpeed || 0,
        hasSlot:        response.hasFreeUploadSlot ? 1 : 0,
      };
    })
    .filter(scored => scored.musicFileCount > 0);

  if (scored.length === 0) {
    return null;
  }

  scored.sort((a, b) => {
    if (b.hasSlot !== a.hasSlot) {
      return b.hasSlot - a.hasSlot;
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

function selectDownloadFiles(response: SlskdSearchResponse): { directory: string; files: SlskdFile[] } | null {
  const directoryMap = new Map<string, { files: Map<string, SlskdFile>; totalSize: number }>();

  // Filter to music files only to avoid downloading non-audio files
  const musicFiles = response.files.filter(f => f.filename && isMusicFile(f.filename));

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

  const sortedGroups = Array.from(directoryMap.entries()).sort((a, b) => {
    if (b[1].files.size !== a[1].files.size) {
      return b[1].files.size - a[1].files.size;
    }

    if (b[1].totalSize !== a[1].totalSize) {
      return b[1].totalSize - a[1].totalSize;
    }

    return a[0].localeCompare(b[0]);
  });

  const [directory, group] = sortedGroups[0];
  const files = Array.from(group.files.values());

  return {
    directory,
    files,
  };
}

async function waitForSearchCompletion(slskdClient: SlskdClient, searchId: string): Promise<'Completed' | 'Cancelled' | 'TimedOut' | 'Unknown'> {
  const startTime = Date.now();

  while (Date.now() - startTime < SEARCH_MAX_WAIT_MS) {
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
