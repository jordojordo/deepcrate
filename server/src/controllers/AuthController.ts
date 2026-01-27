import type { Request, Response } from 'express';
import type { AuthInfoResponse, AuthMeResponse } from '@server/types/responses';

import { BaseController } from '@server/controllers/BaseController';
import { getConfig } from '@server/config/settings';

/**
 * Auth controller for authentication info endpoints
 */
class AuthController extends BaseController {
  /**
   * Get auth configuration (public - no secrets)
   * GET /api/v1/auth/info
   */
  getInfo = (_req: Request, res: Response): Response => {
    const config = getConfig();
    const authSettings = config.ui?.auth;

    const response: AuthInfoResponse = {
      enabled: authSettings?.enabled ?? false,
      type:    authSettings?.enabled ? authSettings.type : 'disabled',
    };

    return res.json(response);
  };

  /**
   * Get current authenticated user info
   * GET /api/v1/auth/me
   */
  getMe = (req: Request, res: Response): Response => {
    const config = getConfig();
    const authSettings = config.ui?.auth;

    let username = 'Guest';

    if (!authSettings?.enabled) {
      username = 'Guest';
    } else {
      switch (authSettings.type) {
        case 'basic':
          username = authSettings.username || 'User';
          break;

        case 'api_key':
          username = 'API User';
          break;

        case 'proxy':
          username = (req.headers['remote-user'] as string) || 'Proxy User';
          break;
      }
    }

    const response: AuthMeResponse = { username };

    return res.json(response);
  };
}

export default new AuthController();
