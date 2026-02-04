import type {
  ActiveDownload, DownloadProgress, DownloadStats, ScoredSearchResponse, DirectoryGroup
} from '@server/types/downloads';
import type { SlskdTransferFile, SlskdUserTransfers, SlskdSearchResponse, SlskdFile } from '@server/types/slskd-client';
import { cachedSearchResultsSchema } from '@server/types/downloads';
import type { QualityPreferences } from '@server/types/slskd';

import fs from 'fs';
import path from 'path';

import { Op } from '@sequelize/core';
import logger from '@server/config/logger';
import { getConfig } from '@server/config/settings';
import { withDbWrite } from '@server/config/db';
import { triggerJob } from '@server/plugins/jobs';
import SlskdClient from '@server/services/clients/SlskdClient';
import WishlistService from '@server/services/WishlistService';
import DownloadTask, { DownloadTaskType, DownloadTaskStatus } from '@server/models/DownloadTask';
import WishlistItem from '@server/models/WishlistItem';
import {
  emitDownloadTaskCreated,
  emitDownloadTaskUpdated,
  emitDownloadProgress,
  emitDownloadStatsUpdated,
  emitDownloadSelectionExpired,
} from '@server/plugins/io/namespaces/downloadsNamespace';
import {
  joinDownloadsPath,
  normalizeSlskdPath,
  slskdDirectoryToRelativeDownloadPath,
  slskdPathBasename,
  toSafeRelativePath
} from '@server/utils/slskdPaths';
import {
  extractQualityInfo,
  getDominantQualityInfo,
  calculateAverageQualityScore,
  shouldRejectFile,
} from '@server/utils/audioQuality';
import {
  MUSIC_EXTENSIONS,
  QUALITY_SCORES,
  DEFAULT_PREFERRED_FORMATS,
  MB_TO_BYTES
} from '@server/constants/slskd';
import { JOB_INTERVALS } from '@server/config/jobs';
import { JOB_NAMES } from '@server/constants/jobs';

async function pathExists(candidatePath: string): Promise<boolean> {
  try {
    await fs.promises.access(candidatePath, fs.constants.F_OK);

    return true;
  } catch {
    return false;
  }
}

function sanitizeUsernameSegment(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const sanitized = value.replace(/[/\\]/g, '-').trim();

  return sanitized.length ? sanitized : null;
}

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
      const progress = this.calculateProgress(task, slskdTransfers);

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

      const progress = this.calculateProgress(task, slskdTransfers);

      if (progress) {
        emitDownloadProgress({
          id: task.id,
          progress,
        });
      }
    }
  }

  /**
   * Tokenize slskd state string into individual flags.
   * slskd returns transfer states as comma-separated enum flags
   * (e.g., "Completed, Succeeded" or "InProgress") rather than single values.
   * This splits and normalizes them for easier checking.
   */
  private tokenizeSlskdState(value: unknown): string[] {
    if (typeof value !== 'string') {
      return [];
    }

    return value
      .split(',')
      .map((part) => part.trim().toLowerCase())
      .filter(Boolean);
  }

  private deriveTransferStatus(files: SlskdTransferFile[]): {
    status:        'queued' | 'downloading' | 'completed' | 'failed';
    errorMessage?: string;
  } {
    const isQueued = (tokens: string[]) => tokens.includes('queued');
    const isCompleted = (tokens: string[]) => tokens.includes('completed') || tokens.includes('succeeded') || tokens.includes('success');
    const isErrored = (tokens: string[]) => tokens.includes('errored') || tokens.includes('error');
    const isCancelled = (tokens: string[]) => tokens.includes('cancelled') || tokens.includes('canceled');
    const isTimedOut = (tokens: string[]) => tokens.includes('timedout') || tokens.includes('timed out');
    const isErrorState = (tokens: string[]) => isErrored(tokens) || isCancelled(tokens) || isTimedOut(tokens);
    const isFinal = (tokens: string[]) => isCompleted(tokens) || isErrorState(tokens);

    let allQueued = true;
    let allCompleted = true;
    let allFinal = true;
    let allBytesTransferred = true;
    const errorFiles: SlskdTransferFile[] = [];

    for (const file of files) {
      const tokens = this.tokenizeSlskdState(file.state);

      if (!isQueued(tokens)) {
        allQueued = false;
      }

      if (!isCompleted(tokens)) {
        allCompleted = false;
      }

      if (!isFinal(tokens)) {
        allFinal = false;
      }

      if (isErrorState(tokens)) {
        errorFiles.push(file);
      }

      if (!Number.isFinite(file.size) || !Number.isFinite(file.bytesTransferred) || file.size > file.bytesTransferred) {
        allBytesTransferred = false;
      }
    }

    if (allCompleted || (allBytesTransferred && errorFiles.length === 0)) {
      return { status: 'completed' };
    }

    if (allFinal && errorFiles.length > 0) {
      return {
        status:       'failed',
        errorMessage: this.summarizeTransferErrors(errorFiles, files.length),
      };
    }

    if (allQueued) {
      return { status: 'queued' };
    }

    return { status: 'downloading' };
  }

  private summarizeTransferErrors(errorFiles: SlskdTransferFile[], totalFiles: number): string {
    const counts = errorFiles.reduce<Record<string, number>>((acc, file) => {
      const state = typeof file.state === 'string' ? file.state : String(file.state);
      const key = state || 'Unknown';

      acc[key] = (acc[key] || 0) + 1;

      return acc;
    }, {});

    const summary = Object.entries(counts)
      .map(([state, count]) => `${ count } ${ state }`)
      .join(', ');

    return `Download failed (${ summary }, ${ totalFiles } total files)`;
  }

  /**
   * Get transfer files for a task by matching username and directory.
   * We match by directory path because slskd doesn't return transfer IDs
   * until after files are enqueued and accepted by the source user.
   * The slskdFileIds field can be used for direct lookup once populated.
   */
  private getFilesForTask(taskDirectory: string, transfers: SlskdUserTransfers): SlskdTransferFile[] {
    const normalizedTaskDirectory = normalizeSlskdPath(taskDirectory);

    if (normalizedTaskDirectory === null) {
      return [];
    }

    const matchingDirectories = transfers.directories.filter((directory) => {
      const normalizedDirectory = normalizeSlskdPath(directory.directory);

      return normalizedDirectory === normalizedTaskDirectory;
    });

    return matchingDirectories.flatMap(directory => directory.files);
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

      const files = this.getFilesForTask(task.slskdDirectory, userTransfers);

      if (!files.length) {
        continue;
      }

      const { status, errorMessage } = this.deriveTransferStatus(files);

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
   * Calculate progress for a task from slskd transfers
   */
  private calculateProgress(
    task: DownloadTask,
    slskdTransfers: SlskdUserTransfers[]
  ): DownloadProgress | null {
    // Only calculate progress for downloading status
    if (task.status !== 'downloading') {
      return null;
    }

    // Find matching user transfers
    const userTransfers = slskdTransfers.find(
      t => t.username === task.slskdUsername
    );

    if (!userTransfers) {
      return null;
    }

    const taskDirectory = normalizeSlskdPath(task.slskdDirectory);

    if (taskDirectory === null) {
      return null;
    }

    // Find matching directory
    const directory = userTransfers.directories.find(
      d => normalizeSlskdPath(d.directory) === taskDirectory
    );

    if (!directory) {
      return null;
    }

    // Aggregate file stats using slskd's built-in properties
    const files = directory.files;

    const filesCompleted = files.filter(f => f.percentComplete >= 100).length;
    const filesTotal = files.length;

    const bytesTransferred = files.reduce((sum, f) => sum + f.bytesTransferred, 0);
    const bytesTotal = files.reduce((sum, f) => sum + f.size, 0);

    // Calculate average speed from active transfers (in progress with remaining bytes)
    const activeFiles = files.filter(
      f => f.percentComplete > 0 && f.percentComplete < 100 && f.bytesRemaining > 0
    );
    const totalSpeed = activeFiles.reduce((sum, f) => sum + (f.averageSpeed || 0), 0);
    const averageSpeed = activeFiles.length > 0 ? totalSpeed : null;

    // Calculate estimated time remaining from active file stats
    const totalBytesRemaining = activeFiles.reduce((sum, f) => sum + f.bytesRemaining, 0);
    let estimatedTimeRemaining: number | null = null;

    if (averageSpeed && totalBytesRemaining > 0) {
      estimatedTimeRemaining = Math.ceil(totalBytesRemaining / averageSpeed);
    }

    return {
      filesCompleted,
      filesTotal,
      bytesTransferred,
      bytesTotal,
      averageSpeed,
      estimatedTimeRemaining,
    };
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

    // Emit updated stats after deletion
    const stats = await this.getStats();

    emitDownloadStatsUpdated(stats);

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

    // Emit socket events
    emitDownloadTaskCreated({
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

    const stats = await this.getStats();

    emitDownloadStatsUpdated(stats);

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
        const directoryRel = slskdDirectoryToRelativeDownloadPath(details?.slskdDirectory);
        const leaf = slskdPathBasename(details?.slskdDirectory);
        const username = sanitizeUsernameSegment(details?.slskdUsername);

        const candidates = new Set<string>();

        if (typeof details?.downloadPath === 'string') {
          candidates.add(details.downloadPath);
        }

        if (username && directoryRel) {
          candidates.add(`${ username }/${ directoryRel }`);
        }

        if (username && leaf) {
          candidates.add(`${ username }/${ leaf }`);
        }

        if (directoryRel) {
          candidates.add(directoryRel);
        }

        if (leaf) {
          candidates.add(leaf);
        }

        for (const candidate of candidates) {
          const safeRel = toSafeRelativePath(candidate);

          if (!safeRel) {
            continue;
          }

          const absPath = joinDownloadsPath(downloadsRoot, safeRel);

          if (await pathExists(absPath)) {
            updateData.downloadPath = safeRel;
            break;
          }
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

    // Emit socket events
    emitDownloadTaskUpdated({
      id,
      status,
      slskdUsername: details?.slskdUsername,
      fileCount:     details?.fileCount,
      errorMessage:  details?.errorMessage,
    });

    const stats = await this.getStats();

    emitDownloadStatsUpdated(stats);
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
    results:          ScoredSearchResponse[];
    skippedUsernames: string[];
  } | null> {
    const task = await DownloadTask.findByPk(taskId);

    if (!task || task.status !== 'pending_selection') {
      return null;
    }

    if (!task.searchResults) {
      return null;
    }

    let responses: SlskdSearchResponse[];

    try {
      const parsed = JSON.parse(task.searchResults);
      const parseResult = cachedSearchResultsSchema.safeParse(parsed);

      if (!parseResult.success) {
        logger.error(`Invalid search results format for task ${ taskId }`, { errors: parseResult.error.issues });

        return null;
      }

      responses = parseResult.data as SlskdSearchResponse[];
    } catch {
      logger.error(`Failed to parse search results for task ${ taskId }`);

      return null;
    }

    const skippedUsernames = task.skippedUsernames || [];
    const config = getConfig();
    const qualityPrefs = config.slskd?.search?.quality_preferences;
    const qualityPreferences: QualityPreferences | undefined = qualityPrefs ? {
      enabled:          qualityPrefs.enabled ?? true,
      preferredFormats: qualityPrefs.preferred_formats ?? [...DEFAULT_PREFERRED_FORMATS],
      minBitrate:       qualityPrefs.min_bitrate ?? 256,
      preferLossless:   qualityPrefs.prefer_lossless ?? true,
      rejectLowQuality: qualityPrefs.reject_low_quality ?? false,
      rejectLossless:   qualityPrefs.reject_lossless ?? false,
    } : undefined;

    const scoredResults = this.scoreSearchResponses(
      responses,
      skippedUsernames,
      qualityPreferences
    );

    return {
      task: {
        id:                 task.id,
        artist:             task.artist,
        album:              task.album,
        searchQuery:        task.searchQuery || `${ task.artist } - ${ task.album }`,
        selectionExpiresAt: task.selectionExpiresAt || null,
      },
      results: scoredResults,
      skippedUsernames,
    };
  }

  /**
   * Score and group search responses for UI display
   */
  private scoreSearchResponses(
    responses: SlskdSearchResponse[],
    skippedUsernames: string[],
    qualityPreferences?: QualityPreferences
  ): ScoredSearchResponse[] {
    const config = getConfig();
    const searchSettings = config.slskd?.search;
    const minFileSizeBytes = (searchSettings?.min_file_size_mb ?? 1) * MB_TO_BYTES;
    const maxFileSizeBytes = (searchSettings?.max_file_size_mb ?? 500) * MB_TO_BYTES;

    return responses
      .filter(response => !skippedUsernames.includes(response.username))
      .map(response => {
        // Filter to music files within size constraints
        let musicFiles = response.files.filter((f) => {
          if (!this.isMusicFile(f.filename)) {
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

        // Apply quality rejection filter if enabled
        if (qualityPreferences?.enabled && qualityPreferences.rejectLowQuality) {
          musicFiles = musicFiles.filter(f => {
            const qualityInfo = extractQualityInfo(f);

            return !shouldRejectFile(qualityInfo, qualityPreferences);
          });
        }

        const qualityScore = qualityPreferences?.enabled? calculateAverageQualityScore(musicFiles, qualityPreferences): QUALITY_SCORES.unknown;

        const hasSlot = response.hasFreeUploadSlot ? 1000 : 0;
        const uploadSpeedBonus = Math.min(response.uploadSpeed || 0, 1000000) / 10000; // Max 100 points for 1MB/s
        const score = hasSlot + qualityScore + (musicFiles.length * 10) + uploadSpeedBonus;

        const directories = this.groupFilesByDirectory(musicFiles);

        return {
          response,
          score,
          musicFileCount: musicFiles.length,
          totalSize:      musicFiles.reduce((sum, f) => sum + (f.size || 0), 0),
          qualityInfo:    getDominantQualityInfo(musicFiles),
          directories,
        };
      })
      .filter(scored => scored.musicFileCount > 0)
      .sort((a, b) => b.score - a.score);
  }

  /**
   * Group files by directory path
   */
  private groupFilesByDirectory(files: SlskdFile[]): DirectoryGroup[] {
    const directoryMap = new Map<string, SlskdFile[]>();

    for (const file of files) {
      const dirPath = path.posix.dirname(file.filename.replace(/\\/g, '/'));
      const existing = directoryMap.get(dirPath) || [];

      existing.push(file);
      directoryMap.set(dirPath, existing);
    }

    return Array.from(directoryMap.entries()).map(([dirPath, dirFiles]) => ({
      path:        dirPath,
      files:       dirFiles,
      totalSize:   dirFiles.reduce((sum, f) => sum + (f.size || 0), 0),
      qualityInfo: getDominantQualityInfo(dirFiles),
    }));
  }

  /**
   * Check if a file is a music file
   */
  private isMusicFile(filename: string): boolean {
    const ext = path.extname(filename).toLowerCase();

    return MUSIC_EXTENSIONS.includes(ext);
  }

  /**
   * User selects a specific search result
   */
  async selectSearchResult(
    taskId: string,
    username: string,
    directory?: string
  ): Promise<{ success: boolean; error?: string }> {
    const task = await DownloadTask.findByPk(taskId);

    if (!task) {
      return { success: false, error: 'Task not found' };
    }

    if (task.status !== 'pending_selection') {
      return { success: false, error: `Task is not pending selection (status: ${ task.status })` };
    }

    // Check if selection has expired
    if (task.selectionExpiresAt && task.selectionExpiresAt < new Date()) {
      return { success: false, error: 'Selection has expired' };
    }

    if (!task.searchResults) {
      return { success: false, error: 'No search results available' };
    }

    let responses: SlskdSearchResponse[];

    try {
      const parsed = JSON.parse(task.searchResults);
      const parseResult = cachedSearchResultsSchema.safeParse(parsed);

      if (!parseResult.success) {
        logger.error(`Invalid search results format for task ${ taskId }`, { errors: parseResult.error.issues });

        return { success: false, error: 'Invalid search results format' };
      }

      responses = parseResult.data as SlskdSearchResponse[];
    } catch {
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

    // Select files from the specified directory or all music files
    const config = getConfig();
    const searchSettings = config.slskd?.search;
    const minFileSizeBytes = (searchSettings?.min_file_size_mb ?? 1) * MB_TO_BYTES;
    const maxFileSizeBytes = (searchSettings?.max_file_size_mb ?? 500) * MB_TO_BYTES;

    const filesToEnqueue = selectedResponse.files.filter(f => {
      if (!this.isMusicFile(f.filename)) {
        return false;
      }

      const size = f.size || 0;

      if (minFileSizeBytes > 0 && size < minFileSizeBytes) {
        return false;
      }

      if (maxFileSizeBytes > 0 && size > maxFileSizeBytes) {
        return false;
      }

      if (directory) {
        const fileDir = path.posix.dirname(f.filename.replace(/\\/g, '/'));

        return fileDir === directory || f.filename.replace(/\\/g, '/').startsWith(directory + '/');
      }

      return true;
    });

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

    emitDownloadTaskUpdated({
      id:            task.id,
      status:        'queued',
      slskdUsername: username,
      fileCount:     enqueueResult.enqueued.length,
    });

    const stats = await this.getStats();

    emitDownloadStatsUpdated(stats);

    const qualityDesc = qualityInfo ? `${ qualityInfo.format }/${ qualityInfo.tier }` : 'unknown';

    logger.info(`Selected download: ${ task.wishlistKey } (${ username }, ${ enqueueResult.enqueued.length } files, ${ qualityDesc })`);

    return { success: true };
  }

  /**
   * User skips a search result (hide from list)
   */
  async skipSearchResult(taskId: string, username: string): Promise<{ success: boolean; error?: string }> {
    const task = await DownloadTask.findByPk(taskId);

    if (!task) {
      return { success: false, error: 'Task not found' };
    }

    if (task.status !== 'pending_selection') {
      return { success: false, error: `Task is not pending selection (status: ${ task.status })` };
    }

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
    const task = await DownloadTask.findByPk(taskId);

    if (!task) {
      return { success: false, error: 'Task not found' };
    }

    if (task.status !== 'pending_selection') {
      return { success: false, error: `Task is not pending selection (status: ${ task.status })` };
    }

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

    emitDownloadTaskUpdated({
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
    const task = await DownloadTask.findByPk(taskId);

    if (!task) {
      return { success: false, error: 'Task not found' };
    }

    if (task.status !== 'pending_selection') {
      return { success: false, error: `Task is not pending selection (status: ${ task.status })` };
    }

    if (!task.searchResults) {
      return { success: false, error: 'No search results available' };
    }

    let responses: SlskdSearchResponse[];

    try {
      const parsed = JSON.parse(task.searchResults);
      const parseResult = cachedSearchResultsSchema.safeParse(parsed);

      if (!parseResult.success) {
        logger.error(`Invalid search results format for task ${ taskId }`, { errors: parseResult.error.issues });

        return { success: false, error: 'Invalid search results format' };
      }

      responses = parseResult.data as SlskdSearchResponse[];
    } catch {
      return { success: false, error: 'Failed to parse search results' };
    }

    const skippedUsernames = task.skippedUsernames || [];
    const config = getConfig();
    const qualityPrefs = config.slskd?.search?.quality_preferences;
    const qualityPreferences: QualityPreferences | undefined = qualityPrefs ? {
      enabled:          qualityPrefs.enabled ?? true,
      preferredFormats: qualityPrefs.preferred_formats ?? [...DEFAULT_PREFERRED_FORMATS],
      minBitrate:       qualityPrefs.min_bitrate ?? 256,
      preferLossless:   qualityPrefs.prefer_lossless ?? true,
      rejectLowQuality: qualityPrefs.reject_low_quality ?? false,
      rejectLossless:   qualityPrefs.reject_lossless ?? false,
    } : undefined;

    const scoredResults = this.scoreSearchResponses(responses, skippedUsernames, qualityPreferences);

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

        emitDownloadSelectionExpired({
          id:     task.id,
          artist: task.artist,
          album:  task.album,
        });

        emitDownloadTaskUpdated({
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
      const stats = await this.getStats();

      emitDownloadStatsUpdated(stats);
    }

    return processedCount;
  }
}

export default DownloadService;
