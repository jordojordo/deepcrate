import type { ActiveDownload, DownloadProgress, DownloadStats } from '@server/types/downloads';

import { Op } from '@sequelize/core';
import logger from '@server/config/logger';
import { getConfig } from '@server/config/settings';
import DownloadedItem from '@server/models/DownloadedItem';
import DownloadTask, { DownloadTaskType, DownloadTaskStatus } from '@server/models/DownloadTask';

import SlskdClient, { type SlskdTransferFile, type SlskdUserTransfers } from './clients/SlskdClient';
import WishlistService from './WishlistService';

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
      this.slskdClient = new SlskdClient(slskdConfig.host, slskdConfig.api_key);
    } else {
      this.slskdClient = null;
      logger.warn('slskd not configured - download progress will not be available');
    }

    this.wishlistService = new WishlistService();
  }

  /**
   * Get active downloads with real-time progress from slskd
   */
  async getActive(params: {
    limit?:  number;
    offset?: number;
  }): Promise<{ items: ActiveDownload[]; total: number }> {
    const { limit = 50, offset = 0 } = params;

    // Query database for active tasks (includes pending for retried items, deferred for timed-out searches)
    let { rows, count } = await DownloadTask.findAndCountAll({
      where: { status: { [Op.in]: ['pending', 'searching', 'queued', 'downloading', 'deferred'] } },
      order: [['queuedAt', 'DESC']],
      limit,
      offset,
    });

    // If no active tasks, return early
    if (!rows.length) {
      return {
        items: [],
        total: count,
      };
    }

    // Get real-time progress from slskd (if configured)
    const slskdTransfers = this.slskdClient ? await this.slskdClient.getDownloads() : [];

    if (slskdTransfers.length) {
      const syncResult = await this.syncTasksFromTransfers(rows, slskdTransfers);

      if (syncResult.activeSetChanged) {
        ({ rows, count } = await DownloadTask.findAndCountAll({
          where: { status: { [Op.in]: ['pending', 'searching', 'queued', 'downloading', 'deferred'] } },
          order: [['queuedAt', 'DESC']],
          limit,
          offset,
        }));
      }
    }

    // Merge database records with real-time progress
    const items: ActiveDownload[] = rows.map(task => {
      const progress = this.calculateProgress(task, slskdTransfers);

      return {
        id:             task.id,
        wishlistKey:    task.wishlistKey,
        artist:         task.artist,
        album:          task.album,
        type:           task.type,
        status:         task.status,
        slskdUsername:  task.slskdUsername || null,
        slskdDirectory: task.slskdDirectory || null,
        fileCount:      task.fileCount || null,
        progress,
        queuedAt:       task.queuedAt,
        startedAt:      task.startedAt || null,
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
   * Normalize slskd path for consistent comparison.
   * slskd returns paths in various formats depending on the source user's OS:
   * - Windows paths with backslashes: "C:\\Music\\Album"
   * - Relative paths: "./Music/Album" or "."
   * - Paths with trailing slashes
   * This normalizes all to forward slashes with no trailing slash.
   */
  private normalizeSlskdPath(value: string | null | undefined): string | null {
    if (value === undefined || value === null) {
      return null;
    }

    const normalized = value.replace(/\\/g, '/').replace(/\/+$/, '');

    return normalized === '.' ? '' : normalized;
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
    const normalizedTaskDirectory = this.normalizeSlskdPath(taskDirectory);

    if (normalizedTaskDirectory === null) {
      return [];
    }

    const matchingDirectories = transfers.directories.filter((directory) => {
      const normalizedDirectory = this.normalizeSlskdPath(directory.directory);

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
        const fallbackDirectory = this.normalizeSlskdPath(userTransfers.directories[0].directory);

        await DownloadTask.update(
          {
            slskdDirectory: fallbackDirectory ?? undefined,
            fileCount:      task.fileCount || userTransfers.directories[0].files.length,
          },
          { where: { id: task.id } }
        );

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

    const taskDirectory = this.normalizeSlskdPath(task.slskdDirectory);

    if (taskDirectory === null) {
      return null;
    }

    // Find matching directory
    const directory = userTransfers.directories.find(
      d => this.normalizeSlskdPath(d.directory) === taskDirectory
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
        // Add to wishlist BEFORE updating task status to prevent race conditions:
        // If we updated task status first, the downloader job could see the pending
        // task but find an empty wishlist, causing the retry to be skipped.
        this.wishlistService.append(
          task.artist,
          task.album,
          task.type === 'album'
        );

        // Then reset task status to pending
        await task.update({
          status:          'pending',
          errorMessage:    undefined,
          retryCount:      task.retryCount + 1,
          slskdSearchId:   undefined,
          slskdUsername:   undefined,
          slskdDirectory:  undefined,
          slskdFileIds:    undefined,
          fileCount:       undefined,
          startedAt:       undefined,
          completedAt:     undefined,
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
   * Get download statistics
   */
  async getStats(): Promise<DownloadStats> {
    const [active, queued, completed, failed] = await Promise.all([
      DownloadTask.count({ where: { status: { [Op.in]: ['pending', 'searching', 'downloading'] } } }),
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
    const task = await DownloadTask.create({
      wishlistKey: params.wishlistKey,
      artist:      params.artist,
      album:       params.album,
      type:        params.type,
      status:      'pending',
      retryCount:  0,
      queuedAt:    new Date(),
    });

    logger.info(`Created download task: ${ params.wishlistKey }`);

    return task;
  }

  /**
   * Update task status (used by slskdDownloader job)
   */
  async updateTaskStatus(
    id: string,
    status: DownloadTaskStatus,
    details?: {
      slskdSearchId?:  string;
      slskdUsername?:  string;
      slskdDirectory?: string;
      slskdFileIds?:   string[];
      fileCount?:      number;
      errorMessage?:   string;
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

    // Merge in optional details
    if (details) {
      Object.assign(updateData, details);
    }

    await DownloadTask.update(updateData, { where: { id } });

    // Create DownloadedItem record when download completes successfully
    if (status === 'completed') {
      const task = await DownloadTask.findByPk(id);

      if (task) {
        await DownloadedItem.findOrCreate({
          where:    { wishlistKey: task.wishlistKey },
          defaults: {
            wishlistKey:  task.wishlistKey,
            downloadedAt: new Date(),
          },
        });
      }
    }

    logger.debug(`Updated task ${ id } to status ${ status }`);
  }
}

export default DownloadService;
