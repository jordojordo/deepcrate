import type { Request, Response } from 'express';
import type { PaginatedResponse } from '@server/types/responses';
import type { ActivityItem } from '@server/types/activity';

import { BaseController } from '@server/controllers/BaseController';
import { getRecentQuerySchema } from '@server/types/activity';
import { sendValidationError } from '@server/utils/errorHandler';
import { ActivityService } from '@server/services/ActivityService';

class ActivityController extends BaseController {
  private activityService: ActivityService;

  constructor() {
    super();
    this.activityService = new ActivityService();
  }

  /**
   * GET /api/v1/activity/recent
   */
  getRecent = async(req: Request, res: Response): Promise<Response> => {
    try {
      const parseResult = getRecentQuerySchema.safeParse(req.query);

      if (!parseResult.success) {
        return sendValidationError(res, 'Invalid query parameters', { errors: parseResult.error.issues });
      }

      const { limit, offset } = parseResult.data;
      const { items, total } = await this.activityService.getRecent({ limit, offset });

      const response: PaginatedResponse<ActivityItem> = {
        items, total, limit, offset 
      };

      return res.json(response);
    } catch(error) {
      return this.handleError(res, error as Error, 'Failed to fetch recent activity');
    }
  };
}

export default new ActivityController();
