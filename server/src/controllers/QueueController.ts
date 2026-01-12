import type { Request, Response } from 'express';

import { BaseController } from '@server/controllers/BaseController';
import {
  getPendingQuerySchema,
  approveRequestSchema,
  rejectRequestSchema,
} from '@server/types/queue';
import type { ActionResponse, PaginatedResponse } from '@server/types/responses';
import { sendValidationError } from '@server/utils/errorHandler';
import { QueueService } from '@server/services/QueueService';
import type QueueItemModel from '@server/models/QueueItem';

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
        source, sort, order, limit, offset 
      } = parseResult.data;

      // Get items from queue service
      const { items: dbItems, total } = await this.queueService.getPending({
        source,
        sort,
        order,
        limit,
        offset,
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
}

export default new QueueController();
