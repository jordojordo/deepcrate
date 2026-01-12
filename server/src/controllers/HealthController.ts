import type { Request, Response } from 'express';

import { BaseController } from '@server/controllers/BaseController';
import type { HealthResponse } from '@server/types/responses';

/**
 * Health check controller
 */
class HealthController extends BaseController {
  /**
   * Health check endpoint
   * GET /health
   */
  check = (req: Request, res: Response): Response => {
    const response: HealthResponse = {
      status:  'ok',
      version: '1.0.0',
      service: 'resonance',
    };

    return res.json(response);
  };
}

export default new HealthController();
