import type { Request, Response } from 'express';
import type { PaginatedResponse } from '@server/types/responses';
import type DownloadTaskModel from '@server/models/DownloadTask';
import type { ActiveDownload, DownloadStats } from '@server/types/downloads';

import { BaseController } from '@server/controllers/BaseController';
import logger from '@server/config/logger';
import {
  getDownloadsQuerySchema,
  retryRequestSchema,
  deleteRequestSchema,
  downloadStatsSchema,
} from '@server/types/downloads';
import { sendValidationError } from '@server/utils/errorHandler';
import { DownloadService } from '@server/services/DownloadService';

/**
 * Downloads controller for managing download visibility
 */
class DownloadsController extends BaseController {
  private downloadService: DownloadService;

  constructor() {
    super();
    this.downloadService = new DownloadService();
  }

  /**
   * Convert Sequelize model to plain object for API response
   */
  private modelToPlainObject(task: DownloadTaskModel) {
    return {
      id:              task.id,
      wishlistKey:     task.wishlistKey,
      artist:          task.artist,
      album:           task.album,
      type:            task.type,
      status:          task.status,
      downloadPath:    task.downloadPath ?? null,
      slskdUsername:   task.slskdUsername,
      slskdDirectory:  task.slskdDirectory,
      fileCount:       task.fileCount,
      errorMessage:    task.errorMessage,
      retryCount:      task.retryCount,
      queuedAt:        task.queuedAt,
      startedAt:       task.startedAt,
      completedAt:     task.completedAt,
    };
  }

  /**
   * Get active downloads with real-time progress
   * GET /api/v1/downloads/active
   */
  getActive = async(req: Request, res: Response): Promise<Response> => {
    try {
      // Validate query parameters
      const parseResult = getDownloadsQuerySchema.safeParse(req.query);

      if (!parseResult.success) {
        return sendValidationError(res, 'Invalid query parameters', { errors: parseResult.error.issues });
      }

      const { limit, offset } = parseResult.data;

      // Get active downloads from service
      const { items, total } = await this.downloadService.getActive({
        limit,
        offset,
      });

      const response: PaginatedResponse<ActiveDownload> = {
        items,
        total,
        limit,
        offset,
      };

      return res.json(response);
    } catch(error) {
      return this.handleError(res, error as Error, 'Failed to fetch active downloads');
    }
  };

  /**
   * Get completed downloads
   * GET /api/v1/downloads/completed
   */
  getCompleted = async(req: Request, res: Response): Promise<Response> => {
    try {
      // Validate query parameters
      const parseResult = getDownloadsQuerySchema.safeParse(req.query);

      if (!parseResult.success) {
        return sendValidationError(res, 'Invalid query parameters', { errors: parseResult.error.issues });
      }

      const { limit, offset } = parseResult.data;

      // Get completed downloads from service
      const { items: dbItems, total } = await this.downloadService.getCompleted({
        limit,
        offset,
      });

      logger.debug('Fetched completed downloads', {
        total,
        limit,
        offset,
      });

      // Convert models to plain objects
      const items = dbItems.map((task) => this.modelToPlainObject(task));

      const response: PaginatedResponse<typeof items[0]> = {
        items,
        total,
        limit,
        offset,
      };

      return res.json(response);
    } catch(error) {
      return this.handleError(res, error as Error, 'Failed to fetch completed downloads');
    }
  };

  /**
   * Get failed downloads
   * GET /api/v1/downloads/failed
   */
  getFailed = async(req: Request, res: Response): Promise<Response> => {
    try {
      // Validate query parameters
      const parseResult = getDownloadsQuerySchema.safeParse(req.query);

      if (!parseResult.success) {
        return sendValidationError(res, 'Invalid query parameters', { errors: parseResult.error.issues });
      }

      const { limit, offset } = parseResult.data;

      // Get failed downloads from service
      const { items: dbItems, total } = await this.downloadService.getFailed({
        limit,
        offset,
      });

      // Convert models to plain objects
      const items = dbItems.map((task) => this.modelToPlainObject(task));

      const response: PaginatedResponse<typeof items[0]> = {
        items,
        total,
        limit,
        offset,
      };

      return res.json(response);
    } catch(error) {
      return this.handleError(res, error as Error, 'Failed to fetch failed downloads');
    }
  };

  /**
   * Retry failed downloads - re-search and re-queue
   * POST /api/v1/downloads/retry
   */
  retry = async(req: Request, res: Response): Promise<Response> => {
    try {
      // Validate request body
      const parseResult = retryRequestSchema.safeParse(req.body);

      if (!parseResult.success) {
        return sendValidationError(res, 'Invalid request body', { errors: parseResult.error.issues });
      }

      const { ids } = parseResult.data;

      // Retry failed downloads
      const result = await this.downloadService.retry(ids);

      const response = {
        success:  true,
        count:    result.success,
        message:  `Retried ${ result.success } downloads, ${ result.failed } failed`,
        failures: result.failures,
      };

      return res.json(response);
    } catch(error) {
      return this.handleError(res, error as Error, 'Failed to retry downloads');
    }
  };

  /**
   * Delete downloads by IDs
   * DELETE /api/v1/downloads
   */
  delete = async(req: Request, res: Response): Promise<Response> => {
    try {
      // Validate request body
      const parseResult = deleteRequestSchema.safeParse(req.body);

      if (!parseResult.success) {
        return sendValidationError(res, 'Invalid request body', { errors: parseResult.error.issues });
      }

      const { ids } = parseResult.data;

      // Delete downloads
      const result = await this.downloadService.delete(ids);

      const response = {
        success:  true,
        count:    result.success,
        message:  `Deleted ${ result.success } download(s)`,
        failures: result.failures,
      };

      return res.json(response);
    } catch(error) {
      return this.handleError(res, error as Error, 'Failed to delete downloads');
    }
  };

  /**
   * Get download statistics
   * GET /api/v1/downloads/stats
   */
  getStats = async(req: Request, res: Response): Promise<Response> => {
    try {
      const stats = await this.downloadService.getStats();

      // Validate the stats response
      const parseResult = downloadStatsSchema.safeParse(stats);

      if (!parseResult.success) {
        throw new Error('Invalid stats data from service');
      }

      const response: DownloadStats = parseResult.data;

      return res.json(response);
    } catch(error) {
      return this.handleError(res, error as Error, 'Failed to fetch download stats');
    }
  };
}

export default new DownloadsController();
