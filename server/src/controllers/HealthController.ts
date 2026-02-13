import type { Request, Response } from 'express';
import type { HealthResponse } from '@server/types/responses';

import { readFileSync } from 'fs';
import { join } from 'path';

import { BaseController } from '@server/controllers/BaseController';
import logger from '@server/config/logger';

const { version } = JSON.parse(readFileSync(join(__dirname, '../../package.json'), 'utf-8'));

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
      version,
      service: 'deepcrate',
    };

    logger.debug('[health]: Fetched health check', response);

    return res.json(response);
  };
}

export default new HealthController();
