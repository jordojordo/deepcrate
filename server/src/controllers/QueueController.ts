import type { Request, Response } from 'express';
import type { ActionResponse, PaginatedResponse } from '@server/types/responses';
import type QueueItemModel from '@server/models/QueueItem';

import { BaseController } from '@server/controllers/BaseController';
import { JOB_NAMES } from '@server/constants/jobs';
import { triggerJob } from '@server/plugins/jobs';
import {
  getPendingQuerySchema,
  approveRequestSchema,
  rejectRequestSchema,
} from '@server/types/queue';
import { sendValidationError } from '@server/utils/errorHandler';
import logger from '@server/config/logger';
import { QueueService } from '@server/services/QueueService';

/**
 * Queue controller for managing pending queue items
 */
class QueueController extends BaseController {
  private queueService: QueueService;

  constructor() {
    super();
    this.queueService = new QueueService();
  }

  /**
   * Convert Sequelize model to plain object for API response
   */
  private modelToPlainObject(item: QueueItemModel) {
    return {
      artist:       item.artist,
      album:        item.album,
      title:        item.title,
      mbid:         item.mbid,
      type:         item.type,
      added_at:     item.addedAt,
      score:        item.score,
      source:       item.source,
      similar_to:   item.similarTo,
      source_track: item.sourceTrack,
      cover_url:    item.coverUrl,
      year:         item.year,
      in_library:   item.inLibrary,
    };
  }

  /**
   * Get paginated list of pending queue items
   * GET /api/v1/queue/pending
   */
  getPending = async(req: Request, res: Response): Promise<Response> => {
    try {
      // Validate query parameters
      const parseResult = getPendingQuerySchema.safeParse(req.query);

      if (!parseResult.success) {
        return sendValidationError(res, 'Invalid query parameters', { errors: parseResult.error.issues });
      }

      const {
        source, sort, order, limit, offset, hide_in_library
      } = parseResult.data;

      // Get items from queue service
      const { items: dbItems, total } = await this.queueService.getPending({
        source,
        sort,
        order,
        limit,
        offset,
        hideInLibrary: hide_in_library,
      });

      // Convert Sequelize models to plain objects
      const items = dbItems.map((item) => this.modelToPlainObject(item));

      const response: PaginatedResponse<typeof items[0]> = {
        items,
        total,
        limit,
        offset,
      };

      return res.json(response);
    } catch(error) {
      return this.handleError(res, error as Error, 'Failed to fetch pending items');
    }
  };

  /**
   * Approve pending items by MBIDs or approve all
   * POST /api/v1/queue/approve
   */
  approve = async(req: Request, res: Response): Promise<Response> => {
    try {
      // Validate request body
      const parseResult = approveRequestSchema.safeParse(req.body);

      if (!parseResult.success) {
        return sendValidationError(res, 'Invalid request body', { errors: parseResult.error.issues });
      }

      const { mbids, all } = parseResult.data;

      // Validate that either mbids or all is provided
      if (!all && (!mbids || mbids.length === 0)) {
        return sendValidationError(
          res,
          "Either 'mbids' or 'all=true' must be provided"
        );
      }

      // Approve items
      const count = all? await this.queueService.approveAll(): await this.queueService.approve(mbids!);

      // Trigger slskd job immediately to start downloads
      if (count > 0) {
        const triggered = triggerJob(JOB_NAMES.SLSKD);

        if (triggered === false) {
          logger.info('slskd job already running, downloads will process shortly');
        } else if (triggered === null) {
          logger.warn('slskd job not found, downloads will wait for next scheduled run');
        }
      }

      const response: ActionResponse = {
        success: true,
        count,
        message: all? `Approved all ${ count } pending items`: `Approved ${ count } items`,
      };

      return res.json(response);
    } catch(error) {
      return this.handleError(res, error as Error, 'Failed to approve items');
    }
  };

  /**
   * Reject pending items by MBIDs
   * POST /api/v1/queue/reject
   */
  reject = async(req: Request, res: Response): Promise<Response> => {
    try {
      // Validate request body
      const parseResult = rejectRequestSchema.safeParse(req.body);

      if (!parseResult.success) {
        return sendValidationError(res, 'Invalid request body', { errors: parseResult.error.issues });
      }

      const { mbids } = parseResult.data;

      // Reject items
      const count = await this.queueService.reject(mbids);

      const response: ActionResponse = {
        success: true,
        count,
        message: `Rejected ${ count } items`,
      };

      return res.json(response);
    } catch(error) {
      return this.handleError(res, error as Error, 'Failed to reject items');
    }
  };

  /**
   * Get queue statistics
   * GET /api/v1/queue/stats
   */
  getStats = async(_req: Request, res: Response): Promise<Response> => {
    try {
      const stats = await this.queueService.getStats();

      return res.json(stats);
    } catch(error) {
      return this.handleError(res, error as Error, 'Failed to fetch queue stats');
    }
  };
}

export default new QueueController();
