import type { ActiveDownload, DownloadStats, ScoredSearchResponse } from '@server/types/downloads';
import type { SlskdUserTransfers } from '@server/types/slskd-client';

import path from 'path';

import { Op } from '@sequelize/core';
import logger from '@server/config/logger';
import { getConfig } from '@server/config/settings';
import { withDbWrite } from '@server/config/db';
import { triggerJob } from '@server/plugins/jobs';
import SlskdClient from '@server/services/clients/SlskdClient';
import WishlistService from '@server/services/WishlistService';
import { parseCachedSearchResults } from '@server/services/downloads/searchResultParser';
import { buildQualityPreferences } from '@server/services/downloads/qualityPrefsBuilder';
import { getFileSizeConstraints, filterMusicFiles } from '@server/services/downloads/musicFileFilter';
import { resolveDownloadPath } from '@server/services/downloads/downloadPathResolver';
import {
  deriveTransferStatus,
  getFilesForTask,
  calculateProgress,
} from '@server/services/downloads/transferSync';
import { scoreSearchResponses } from '@server/services/downloads/searchResultScorer';
import DownloadTask, { DownloadTaskType, DownloadTaskStatus } from '@server/models/DownloadTask';
import WishlistItem from '@server/models/WishlistItem';
import { downloadsNs, activityNs } from '@server/plugins/io/namespaces';
import { normalizeSlskdPath } from '@server/utils/slskdPaths';
import { getDominantQualityInfo } from '@server/utils/audioQuality';
import { JOB_INTERVALS } from '@server/config/jobs';
import { JOB_NAMES } from '@server/constants/jobs';

/**
 * DownloadService manages download tasks and integrates with slskd.
 * Provides visibility into download lifecycle with real-time progress from slskd.
 */
export class DownloadService {
  private slskdClient:     SlskdClient | null;
  private wishlistService: WishlistService;

  constructor() {
    const config = getConfig();
    const slskdConfig = config.slskd;

    // slskd is optional - initialize client only if configured
    if (slskdConfig?.host && slskdConfig?.api_key) {
      this.slskdClient = new SlskdClient(slskdConfig.host, slskdConfig.api_key, slskdConfig.url_base);
    } else {
      this.slskdClient = null;
      logger.warn('slskd not configured - download progress will not be available');
    }

    this.wishlistService = new WishlistService();
  }

  private async emitStatsUpdate(): Promise<void> {
    const stats = await this.getStats();

    downloadsNs.emitDownloadStatsUpdated(stats);
  }

  async getActive(params: {
    limit?:  number;
    offset?: number;
  }): Promise<{ items: ActiveDownload[]; total: number }> {
    const { limit = 50, offset = 0 } = params;

    let { rows, count } = await DownloadTask.findAndCountAll({
      where: { status: { [Op.in]: ['pending', 'searching', 'pending_selection', 'queued', 'downloading', 'deferred'] } },
      order: [['queuedAt', 'DESC']],
      limit,
      offset,
    });

    if (!rows.length) {
      return {
        items: [],
        total: count,
      };
    }

    // Get progress from slskd (if configured)
    const slskdTransfers = this.slskdClient ? await this.slskdClient.getDownloads() : [];

    if (slskdTransfers.length) {
      const syncResult = await this.syncTasksFromTransfers(rows, slskdTransfers);

      if (syncResult.activeSetChanged) {
        ({ rows, count } = await DownloadTask.findAndCountAll({
          where: { status: { [Op.in]: ['pending', 'searching', 'pending_selection', 'queued', 'downloading', 'deferred'] } },
          order: [['queuedAt', 'DESC']],
          limit,
          offset,
        }));
      }
    }

    // Merge database records with progress
    const items: ActiveDownload[] = rows.map(task => {
      const progress = calculateProgress(task, slskdTransfers);

      return {
        id:                  task.id,
        wishlistKey:         task.wishlistKey,
        artist:              task.artist,
        album:               task.album,
        type:                task.type,
        status:              task.status,
        slskdUsername:       task.slskdUsername || null,
        slskdDirectory:      task.slskdDirectory || null,
        fileCount:           task.fileCount || null,
        quality:             task.qualityFormat ? {
          format:     task.qualityFormat,
          bitRate:    task.qualityBitRate ?? null,
          bitDepth:   task.qualityBitDepth ?? null,
          sampleRate: task.qualitySampleRate ?? null,
          tier:       task.qualityTier ?? 'unknown',
        } : null,
        progress,
        searchQuery:         task.searchQuery || null,
        selectionExpiresAt:  task.selectionExpiresAt || null,
        queuedAt:            task.queuedAt,
        startedAt:           task.startedAt || null,
      };
    });

    return {
      items,
      total: count,
    };
  }

  /**
   * Sync queued/downloading task statuses from slskd transfers.
   * Intended to be called by background jobs and by UI polling endpoints.
   */
  async syncTaskStatusesFromTransfers(transfers: SlskdUserTransfers[]): Promise<void> {
    if (!transfers.length) {
      return;
    }

    const tasks = await DownloadTask.findAll({ where: { status: { [Op.in]: ['queued', 'downloading'] } } });

    await this.syncTasksFromTransfers(tasks, transfers);
  }

  /**
   * Sync progress for active downloads and emit WebSocket events.
   * This should be called periodically to push progress updates to connected clients.
   */
  async syncAndEmitProgress(): Promise<void> {
    if (!this.slskdClient) {
      return;
    }

    const tasks = await DownloadTask.findAll({ where: { status: { [Op.in]: ['queued', 'downloading'] } } });

    if (!tasks.length) {
      return;
    }

    const slskdTransfers = await this.slskdClient.getDownloads();

    if (!slskdTransfers.length) {
      return;
    }

    // Sync status changes (this emits task:updated events for status changes)
    await this.syncTasksFromTransfers(tasks, slskdTransfers);

    for (const task of tasks) {
      if (task.status !== 'downloading') {
        continue;
      }

      const progress = calculateProgress(task, slskdTransfers);

      if (progress) {
        downloadsNs.emitDownloadProgress({
          id: task.id,
          progress,
        });
      }
    }
  }

  private async syncTasksFromTransfers(
    tasks: DownloadTask[],
    transfers: SlskdUserTransfers[],
  ): Promise<{ updated: boolean; activeSetChanged: boolean }> {
    let updated = false;
    let activeSetChanged = false;

    for (const task of tasks) {
      if (!task.slskdUsername) {
        continue;
      }

      if (task.status !== 'queued' && task.status !== 'downloading') {
        continue;
      }

      const userTransfers = transfers.find((transfer) => transfer.username === task.slskdUsername);

      if (!userTransfers) {
        continue;
      }

      if ((task.slskdDirectory === null || task.slskdDirectory === undefined) && userTransfers.directories.length === 1) {
        const fallbackDirectory = normalizeSlskdPath(userTransfers.directories[0].directory);

        await withDbWrite(() => DownloadTask.update(
          {
            slskdDirectory: fallbackDirectory ?? undefined,
            fileCount:      task.fileCount || userTransfers.directories[0].files.length,
          },
          { where: { id: task.id } }
        ));

        task.slskdDirectory = fallbackDirectory ?? undefined;
      }

      if (task.slskdDirectory === null || task.slskdDirectory === undefined) {
        continue;
      }

      const files = getFilesForTask(task.slskdDirectory, userTransfers);

      if (!files.length) {
        continue;
      }

      const { status, errorMessage } = deriveTransferStatus(files);

      if (status === task.status) {
        continue;
      }

      updated = true;

      if (status === 'completed' || status === 'failed') {
        activeSetChanged = true;
      }

      await this.updateTaskStatus(task.id, status as DownloadTaskStatus, {
        slskdUsername:  task.slskdUsername,
        slskdDirectory: task.slskdDirectory,
        fileCount:      task.fileCount || files.length,
        errorMessage:   status === 'failed' ? errorMessage : undefined,
      });

      task.status = status as DownloadTaskStatus;
      task.errorMessage = status === 'failed' ? errorMessage : undefined;
    }

    return { updated, activeSetChanged };
  }

  /**
   * Get completed downloads
   */
  async getCompleted(params: {
    limit?:  number;
    offset?: number;
  }): Promise<{ items: DownloadTask[]; total: number }> {
    const { limit = 50, offset = 0 } = params;

    const { rows, count } = await DownloadTask.findAndCountAll({
      where:  { status: 'completed' },
      order:  [['completedAt', 'DESC']],
      limit,
      offset,
    });

    return {
      items: rows,
      total: count,
    };
  }

  /**
   * Get failed downloads
   */
  async getFailed(params: {
    limit?:  number;
    offset?: number;
  }): Promise<{ items: DownloadTask[]; total: number }> {
    const { limit = 50, offset = 0 } = params;

    const { rows, count } = await DownloadTask.findAndCountAll({
      where:  { status: 'failed' },
      order:  [['completedAt', 'DESC']],
      limit,
      offset,
    });

    return {
      items: rows,
      total: count,
    };
  }

  /**
   * Retry failed downloads - re-search and re-queue
   */
  async retry(ids: string[]): Promise<{
    success:  number;
    failed:   number;
    failures: Array<{ id: string; wishlistKey: string; reason: string }>;
  }> {
    if (!ids.length) {
      return {
        success: 0, failed: 0, failures: []
      };
    }

    // Find failed tasks
    const tasks = await DownloadTask.findAll({
      where: {
        id:     { [Op.in]: ids },
        status: 'failed',
      },
    });

    if (!tasks.length) {
      return {
        success: 0, failed: 0, failures: []
      };
    }

    let successCount = 0;
    let failedCount = 0;
    const failures: Array<{ id: string; wishlistKey: string; reason: string }> = [];

    for (const task of tasks) {
      try {
        // Wrap both wishlist item creation and task update in a single mutex block
        // to prevent race conditions where the downloader job could see the pending
        // task before the wishlist item exists
        await withDbWrite(async() => {
          // Find or create wishlist item
          const existing = await this.wishlistService.findByArtistAlbum(
            task.artist, task.album, task.type
          );

          const wishlistItem = existing ?? await WishlistItem.create({
            artist:  task.artist,
            album:   task.album,
            type:    task.type,
            year:    task.year,
            source:  'manual',
            addedAt: new Date(),
          });

          // Reset task status to pending and link to the wishlist item
          await task.update({
            status:         'pending',
            wishlistItemId: wishlistItem.id,
            errorMessage:   undefined,
            retryCount:     task.retryCount + 1,
            downloadPath:   undefined,
            slskdSearchId:  undefined,
            slskdUsername:  undefined,
            slskdDirectory: undefined,
            slskdFileIds:   undefined,
            fileCount:      undefined,
            startedAt:      undefined,
            completedAt:    undefined,
          });
        });

        successCount++;
        logger.info(`Retry queued: ${ task.wishlistKey } (attempt ${ task.retryCount + 1 })`);
      } catch(error) {
        failedCount++;
        const reason = error instanceof Error ? error.message : String(error);

        failures.push({
          id:          task.id,
          wishlistKey: task.wishlistKey,
          reason,
        });
        logger.error(`Failed to retry ${ task.wishlistKey }: ${ reason }`);
      }
    }

    return {
      success: successCount,
      failed:  failedCount,
      failures,
    };
  }

  /**
   * Delete download tasks by ID.
   * Also cancels any active downloads in slskd for tasks that have file IDs.
   */
  async delete(ids: string[]): Promise<{
    success:  number;
    failed:   number;
    failures: Array<{ id: string; reason: string }>;
  }> {
    if (!ids.length) {
      return {
        success: 0, failed: 0, failures: []
      };
    }

    const tasks = await DownloadTask.findAll({ where: { id: { [Op.in]: ids } } });

    if (!tasks.length) {
      return {
        success: 0, failed: 0, failures: []
      };
    }

    let successCount = 0;
    let failedCount = 0;
    const failures: Array<{ id: string; reason: string }> = [];

    for (const task of tasks) {
      try {
        // Cancel downloads in slskd if the task has active transfers
        if (this.slskdClient && task.slskdUsername && task.slskdFileIds?.length) {
          for (const fileId of task.slskdFileIds) {
            try {
              await this.slskdClient.cancelDownload(task.slskdUsername, fileId);
            } catch(cancelError) {
              // Log but don't fail the delete if slskd cancel fails
              logger.debug(`Failed to cancel slskd transfer ${ fileId }: ${ String(cancelError) }`);
            }
          }
          logger.info(`Cancelled ${ task.slskdFileIds.length } slskd transfers for: ${ task.wishlistKey }`);
        }

        await withDbWrite(() => task.destroy());

        // Remove from wishlist to prevent re-processing
        await this.wishlistService.remove(task.artist, task.album);

        successCount++;
        logger.info(`Deleted download task: ${ task.wishlistKey }`);
      } catch(error) {
        failedCount++;
        const reason = error instanceof Error ? error.message : String(error);

        failures.push({
          id: task.id,
          reason,
        });
        logger.error(`Failed to delete ${ task.wishlistKey }: ${ reason }`);
      }
    }

    await this.emitStatsUpdate();

    return {
      success: successCount, failed: failedCount, failures
    };
  }

  /**
   * Get download statistics
   */
  async getStats(): Promise<DownloadStats> {
    const [active, queued, completed, failed] = await Promise.all([
      DownloadTask.count({ where: { status: { [Op.in]: ['pending', 'searching', 'pending_selection', 'downloading'] } } }),
      DownloadTask.count({ where: { status: 'queued' } }),
      DownloadTask.count({ where: { status: 'completed' } }),
      DownloadTask.count({ where: { status: 'failed' } }),
    ]);

    // Try to get total bandwidth from slskd (if configured)
    let totalBandwidth: number | null = null;

    if (this.slskdClient) {
      try {
        const transfers = await this.slskdClient.getDownloads();
        const allFiles = transfers.flatMap(t =>
          t.directories.flatMap(d => d.files)
        );

        // Use percentComplete and bytesRemaining to identify actively transferring files
        const activeFiles = allFiles.filter(
          f => f.percentComplete > 0 && f.percentComplete < 100 && f.bytesRemaining > 0
        );

        totalBandwidth = activeFiles.reduce((sum, f) => sum + (f.averageSpeed || 0), 0);
      } catch(error) {
        logger.debug(`Could not get bandwidth from slskd: ${ String(error) }`);
      }
    }

    return {
      active,
      queued,
      completed,
      failed,
      totalBandwidth,
    };
  }

  /**
   * Create a new download task (used by slskdDownloader job)
   */
  async createTask(params: {
    wishlistKey: string;
    artist:      string;
    album:       string;
    type:        DownloadTaskType;
  }): Promise<DownloadTask> {
    const task = await withDbWrite(() => DownloadTask.create({
      wishlistKey: params.wishlistKey,
      artist:      params.artist,
      album:       params.album,
      type:        params.type,
      status:      'pending',
      retryCount:  0,
      queuedAt:    new Date(),
    }));

    logger.info(`Created download task: ${ params.wishlistKey }`);

    downloadsNs.emitDownloadTaskCreated({
      task: {
        id:             task.id,
        wishlistKey:    task.wishlistKey,
        artist:         task.artist,
        album:          task.album,
        type:           task.type,
        status:         task.status,
        slskdUsername:  null,
        slskdDirectory: null,
        fileCount:      null,
        quality:        null,
        progress:       null,
        queuedAt:       task.queuedAt,
        startedAt:      null,
      },
    });

    await this.emitStatsUpdate();

    return task;
  }

  /**
   * Update task status (used by slskdDownloader job)
   */
  async updateTaskStatus(
    id: string,
    status: DownloadTaskStatus,
    details?: {
      slskdSearchId?:     string;
      slskdUsername?:     string;
      slskdDirectory?:    string;
      slskdFileIds?:      string[];
      downloadPath?:      string;
      fileCount?:         number;
      qualityFormat?:     string;
      qualityBitRate?:    number;
      qualityBitDepth?:   number;
      qualitySampleRate?: number;
      qualityTier?:       string;
      errorMessage?:      string;
    }
  ): Promise<void> {
    const updateData: Record<string, unknown> = { status };

    // Set timestamps based on status
    if (status === 'downloading' && !details?.slskdDirectory) {
      // Do nothing - startedAt should be set when we have actual download data
    } else if (status === 'downloading') {
      updateData.startedAt = new Date();
    }

    if (status === 'completed' || status === 'failed') {
      updateData.completedAt = new Date();
    }

    if (status === 'completed') {
      const downloadsRoot = getConfig().library_organize?.downloads_path;

      if (downloadsRoot) {
        const resolved = await resolveDownloadPath({
          downloadsRoot,
          downloadPath:   details?.downloadPath,
          slskdDirectory:  details?.slskdDirectory,
          slskdUsername:   details?.slskdUsername,
        });

        if (resolved) {
          updateData.downloadPath = resolved;
        }
      }
    }

    // Merge in optional details
    if (details) {
      Object.assign(updateData, details);
    }

    await withDbWrite(() => DownloadTask.update(updateData, { where: { id } }));

    // Handle completed downloads
    if (status === 'completed') {
      const task = await DownloadTask.findByPk(id);

      if (task) {
        activityNs.emitActivityNew({
          item: {
            id:          `download-${ task.id }`,
            title:       `${ task.artist } - ${ task.album }`,
            description: 'Download finished',
            timestamp:   new Date().toISOString(),
            type:        'downloaded',
          },
        });

        // Auto-trigger library organize if enabled and not manual-only
        const config = getConfig();

        if (config.library_organize?.enabled && JOB_INTERVALS.libraryOrganize.seconds > 0) {
          const triggered = triggerJob(JOB_NAMES.LIBRARY_ORGANIZE);

          if (triggered) {
            logger.debug(`Triggered library organize after completing: ${ task.wishlistKey }`);
          }
        }
      }
    }

    logger.debug(`Updated task ${ id } to status ${ status }`);

    downloadsNs.emitDownloadTaskUpdated({
      id,
      status,
      slskdUsername: details?.slskdUsername,
      fileCount:     details?.fileCount,
      errorMessage:  details?.errorMessage,
    });

    await this.emitStatsUpdate();
  }

  /**
   * Get search results for a pending_selection task
   */
  async getSearchResults(taskId: string): Promise<{
    task: {
      id:                 string;
      artist:             string;
      album:              string;
      searchQuery:        string;
      selectionExpiresAt: Date | null;
    };
    results:              ScoredSearchResponse[];
    skippedUsernames:     string[];
    minCompletenessRatio: number;
  } | null> {
    const task = await DownloadTask.findByPk(taskId);

    if (!task || task.status !== 'pending_selection') {
      return null;
    }

    if (!task.searchResults) {
      return null;
    }

    const responses = parseCachedSearchResults(task.searchResults, taskId);

    if (!responses) {
      return null;
    }

    const skippedUsernames = task.skippedUsernames || [];
    const config = getConfig();
    const searchSettings = config.slskd?.search;

    const scoredResults = scoreSearchResponses(responses, skippedUsernames, {
      constraints:        getFileSizeConstraints(searchSettings),
      qualityPreferences: buildQualityPreferences(searchSettings?.quality_preferences),
      expectedTrackCount: task.expectedTrackCount ?? undefined,
      completenessConfig: searchSettings?.completeness,
    });

    return {
      task: {
        id:                 task.id,
        artist:             task.artist,
        album:              task.album,
        searchQuery:        task.searchQuery || `${ task.artist } - ${ task.album }`,
        selectionExpiresAt: task.selectionExpiresAt || null,
      },
      results:              scoredResults,
      skippedUsernames,
      minCompletenessRatio: searchSettings?.completeness?.min_completeness_ratio ?? 0.5,
    };
  }

  private async findPendingSelectionTask(taskId: string): Promise<
    { task: DownloadTask } | { error: string }
  > {
    const task = await DownloadTask.findByPk(taskId);

    if (!task) {
      return { error: 'Task not found' };
    }

    if (task.status !== 'pending_selection') {
      return { error: `Task is not pending selection (status: ${ task.status })` };
    }

    return { task };
  }

  /**
   * User selects a specific search result
   */
  async selectSearchResult(
    taskId: string,
    username: string,
    directory?: string
  ): Promise<{ success: boolean; error?: string }> {
    const result = await this.findPendingSelectionTask(taskId);

    if ('error' in result) {
      return { success: false, error: result.error };
    }

    const { task } = result;

    // Check if selection has expired
    if (task.selectionExpiresAt && task.selectionExpiresAt < new Date()) {
      return { success: false, error: 'Selection has expired' };
    }

    if (!task.searchResults) {
      return { success: false, error: 'No search results available' };
    }

    const responses = parseCachedSearchResults(task.searchResults, taskId);

    if (!responses) {
      return { success: false, error: 'Failed to parse search results' };
    }

    const selectedResponse = responses.find(r => r.username === username);

    if (!selectedResponse) {
      // Sanitize username for error message (truncate and escape HTML chars)
      const sanitizedUsername = username.slice(0, 50).replace(/[<>&"']/g, '');

      return { success: false, error: `User ${ sanitizedUsername } not found in search results` };
    }

    if (!this.slskdClient) {
      return { success: false, error: 'slskd client not configured' };
    }

    const constraints = getFileSizeConstraints(getConfig().slskd?.search);
    const filesToEnqueue = filterMusicFiles(selectedResponse.files, constraints, directory);

    if (filesToEnqueue.length === 0) {
      return { success: false, error: 'No valid files to download' };
    }

    const selectedDirectory = directory || path.posix.dirname(filesToEnqueue[0].filename.replace(/\\/g, '/'));

    const enqueueResult = await this.slskdClient.enqueue(username, filesToEnqueue);

    if (!enqueueResult || enqueueResult.enqueued.length === 0) {
      await this.updateTaskStatus(task.id, 'failed', {
        slskdUsername: username,
        errorMessage:  `slskd rejected all ${ filesToEnqueue.length } files`,
      });

      return { success: false, error: 'Failed to enqueue files' };
    }

    const fileIds = enqueueResult.enqueued.map(f => f.id).filter((id): id is string => typeof id === 'string');
    const qualityInfo = getDominantQualityInfo(filesToEnqueue);

    if (task.slskdSearchId) {
      try {
        await this.slskdClient.deleteSearch(task.slskdSearchId);
      } catch {
        // Ignore errors deleting search
      }
    }

    await withDbWrite(() => task.update({
      status:             'queued',
      slskdUsername:      username,
      slskdDirectory:     selectedDirectory,
      slskdFileIds:       fileIds.length > 0 ? fileIds : undefined,
      fileCount:          enqueueResult.enqueued.length,
      qualityFormat:      qualityInfo?.format,
      qualityBitRate:     qualityInfo?.bitRate ?? undefined,
      qualityBitDepth:    qualityInfo?.bitDepth ?? undefined,
      qualitySampleRate:  qualityInfo?.sampleRate ?? undefined,
      qualityTier:        qualityInfo?.tier,
      searchResults:      undefined,
      selectionExpiresAt: undefined,
      skippedUsernames:   undefined,
      errorMessage:       undefined,
    }));

    downloadsNs.emitDownloadTaskUpdated({
      id:            task.id,
      status:        'queued',
      slskdUsername: username,
      fileCount:     enqueueResult.enqueued.length,
    });

    await this.emitStatsUpdate();

    const qualityDesc = qualityInfo ? `${ qualityInfo.format }/${ qualityInfo.tier }` : 'unknown';

    logger.info(`Selected download: ${ task.wishlistKey } (${ username }, ${ enqueueResult.enqueued.length } files, ${ qualityDesc })`);

    return { success: true };
  }

  /**
   * User skips a search result (hide from list)
   */
  async skipSearchResult(taskId: string, username: string): Promise<{ success: boolean; error?: string }> {
    const result = await this.findPendingSelectionTask(taskId);

    if ('error' in result) {
      return { success: false, error: result.error };
    }

    const { task } = result;
    const skippedUsernames = task.skippedUsernames || [];

    if (!skippedUsernames.includes(username)) {
      skippedUsernames.push(username);
    }

    await withDbWrite(() => task.update({ skippedUsernames }));

    logger.debug(`Skipped user ${ username } for task ${ task.wishlistKey }`);

    return { success: true };
  }

  /**
   * User triggers a new search with optional modified query
   */
  async retrySearch(taskId: string, query?: string): Promise<{ success: boolean; error?: string }> {
    const result = await this.findPendingSelectionTask(taskId);

    if ('error' in result) {
      return { success: false, error: result.error };
    }

    const { task } = result;

    if (!this.slskdClient) {
      return { success: false, error: 'slskd client not configured' };
    }

    if (task.slskdSearchId) {
      try {
        await this.slskdClient.deleteSearch(task.slskdSearchId);
      } catch {
        // Ignore
      }
    }

    const searchQuery = query || task.searchQuery || `${ task.artist } - ${ task.album }`;

    await withDbWrite(() => task.update({
      status:             'searching',
      searchQuery,
      searchResults:      undefined,
      selectionExpiresAt: undefined,
      skippedUsernames:   undefined,
      slskdSearchId:      undefined,
      errorMessage:       undefined,
    }));

    downloadsNs.emitDownloadTaskUpdated({
      id:     task.id,
      status: 'searching',
    });

    logger.info(`Retry search requested for ${ task.wishlistKey } with query: ${ searchQuery }`);

    triggerJob(JOB_NAMES.SLSKD);

    return { success: true };
  }

  /**
   * User chooses to auto-select the best result
   */
  async autoSelectBest(taskId: string): Promise<{ success: boolean; error?: string }> {
    const result = await this.findPendingSelectionTask(taskId);

    if ('error' in result) {
      return { success: false, error: result.error };
    }

    const { task } = result;

    if (!task.searchResults) {
      return { success: false, error: 'No search results available' };
    }

    const responses = parseCachedSearchResults(task.searchResults, taskId);

    if (!responses) {
      return { success: false, error: 'Failed to parse search results' };
    }

    const skippedUsernames = task.skippedUsernames || [];
    const searchSettings = getConfig().slskd?.search;

    const scoredResults = scoreSearchResponses(responses, skippedUsernames, {
      constraints:        getFileSizeConstraints(searchSettings),
      qualityPreferences: buildQualityPreferences(searchSettings?.quality_preferences),
      expectedTrackCount: task.expectedTrackCount ?? undefined,
      completenessConfig: searchSettings?.completeness,
    });

    if (scoredResults.length === 0) {
      return { success: false, error: 'No valid results after filtering' };
    }

    const best = scoredResults[0];

    return this.selectSearchResult(taskId, best.response.username);
  }

  /**
   * Process expired selections and mark them as failed
   */
  async processExpiredSelections(): Promise<number> {
    const now = new Date();

    const expiredTasks = await DownloadTask.findAll({
      where: {
        status:             'pending_selection',
        selectionExpiresAt: { [Op.lt]: now },
      },
    });

    let processedCount = 0;

    for (const task of expiredTasks) {
      try {
        if (this.slskdClient && task.slskdSearchId) {
          try {
            await this.slskdClient.deleteSearch(task.slskdSearchId);
          } catch {
            // Ignore
          }
        }

        await withDbWrite(() => task.update({
          status:             'failed',
          errorMessage:       'Selection timeout expired',
          completedAt:        now,
          searchResults:      undefined,
          selectionExpiresAt: undefined,
          skippedUsernames:   undefined,
        }));

        downloadsNs.emitDownloadSelectionExpired({
          id:     task.id,
          artist: task.artist,
          album:  task.album,
        });

        downloadsNs.emitDownloadTaskUpdated({
          id:           task.id,
          status:       'failed',
          errorMessage: 'Selection timeout expired',
        });

        logger.info(`Selection expired for: ${ task.wishlistKey }`);
        processedCount++;
      } catch(error) {
        logger.error(`Failed to process expired selection for ${ task.wishlistKey }:`, { error });
      }
    }

    if (processedCount > 0) {
      await this.emitStatsUpdate();
    }

    return processedCount;
  }
}

export default DownloadService;
