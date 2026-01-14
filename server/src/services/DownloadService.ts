import type { ActiveDownload, DownloadProgress, DownloadStats } from '@server/types/downloads';

import { Op } from '@sequelize/core';
import logger from '@server/config/logger';
import { getConfig } from '@server/config/settings';
import DownloadTask, { DownloadTaskType, DownloadTaskStatus } from '@server/models/DownloadTask';

import SlskdClient, { SlskdUserTransfers } from './clients/SlskdClient';
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

    // Query database for active tasks
    const { rows, count } = await DownloadTask.findAndCountAll({
      where: { status: { [Op.in]: ['searching', 'queued', 'downloading'] } },
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

    // Find matching directory
    const directory = userTransfers.directories.find(
      d => d.directory === task.slskdDirectory
    );

    if (!directory) {
      return null;
    }

    // Aggregate file stats
    const files = directory.files;
    const filesCompleted = files.filter(
      f => f.state === 'Completed'
    ).length;
    const filesTotal = files.length;

    const bytesTransferred = files.reduce(
      (sum, f) => sum + f.bytesTransferred,
      0
    );
    const bytesTotal = files.reduce(
      (sum, f) => sum + f.size,
      0
    );

    // Calculate average speed from active transfers
    const activeFiles = files.filter(
      f => f.state === 'InProgress' && f.averageSpeed
    );
    const totalSpeed = activeFiles.reduce(
      (sum, f) => sum + (f.averageSpeed || 0),
      0
    );
    const averageSpeed = activeFiles.length > 0 ? totalSpeed : null;

    // Calculate estimated time remaining
    let estimatedTimeRemaining: number | null = null;

    if (averageSpeed && bytesTotal > bytesTransferred) {
      const bytesRemaining = bytesTotal - bytesTransferred;

      estimatedTimeRemaining = Math.ceil(bytesRemaining / averageSpeed);
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
  async retry(ids: string[]): Promise<{ success: number; failed: number }> {
    if (!ids.length) {
      return { success: 0, failed: 0 };
    }

    // Find failed tasks
    const tasks = await DownloadTask.findAll({
      where: {
        id:     { [Op.in]: ids },
        status: 'failed',
      },
    });

    if (!tasks.length) {
      return { success: 0, failed: 0 };
    }

    let successCount = 0;
    let failedCount = 0;

    for (const task of tasks) {
      try {
        // Reset task status to pending
        await task.update({
          status:          'pending',
          errorMessage:    undefined,
          retryCount:      task.retryCount + 1,
          slskdSearchId:   undefined,
          slskdUsername:   undefined,
          slskdDirectory:  undefined,
          fileCount:       undefined,
          startedAt:       undefined,
          completedAt:     undefined,
        });

        // Add back to wishlist for slskdDownloader job to pick up
        this.wishlistService.append(
          task.artist,
          task.album,
          task.type === 'album'
        );

        successCount++;
        logger.info(`Retry queued: ${ task.wishlistKey } (attempt ${ task.retryCount })`);
      } catch(error) {
        failedCount++;
        logger.error(`Failed to retry ${ task.wishlistKey }: ${ String(error) }`);
      }
    }

    return {
      success: successCount,
      failed:  failedCount,
    };
  }

  /**
   * Get download statistics
   */
  async getStats(): Promise<DownloadStats> {
    const [active, queued, completed, failed] = await Promise.all([
      DownloadTask.count({ where: { status: { [Op.in]: ['searching', 'downloading'] } } }),
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
        const activeFiles = allFiles.filter(
          f => f.state === 'InProgress' && f.averageSpeed
        );

        totalBandwidth = activeFiles.reduce(
          (sum, f) => sum + (f.averageSpeed || 0),
          0
        );
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

    logger.debug(`Updated task ${ id } to status ${ status }`);
  }
}

export default DownloadService;
