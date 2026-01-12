import type { Response } from 'express';

import { handleError } from '@server/utils/errorHandler';

/**
 * Base controller class with common error handling
 */
export class BaseController {
  /**
   * Handle errors in a consistent way across all controllers
   */
  protected handleError(
    res: Response,
    error: Error,
    defaultMessage = 'An unexpected error occurred.'
  ): Response {
    return handleError(res, error, defaultMessage);
  }
}
