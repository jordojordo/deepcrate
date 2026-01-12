import type { Response } from 'express';

import logger from '@server/config/logger';
import type { ErrorResponse } from '@server/types/responses';

/**
 * Handle errors and send appropriate response
 */
export function handleError(
  res: Response,
  error: Error,
  defaultMessage = 'An unexpected error occurred.'
): Response {
  logger.error(`Error: ${ error.message }`, { stack: error.stack });

  const errorResponse: ErrorResponse = {
    error:   true,
    code:    'internal_error',
    message: defaultMessage,
    details: {},
  };

  return res.status(500).json(errorResponse);
}

/**
 * Send validation error response
 */
export function sendValidationError(
  res: Response,
  message: string,
  details: Record<string, unknown> = {}
): Response {
  const errorResponse: ErrorResponse = {
    error: true,
    code:  'validation_error',
    message,
    details,
  };

  return res.status(400).json(errorResponse);
}

/**
 * Send not found error response
 */
export function sendNotFoundError(
  res: Response,
  message = 'Resource not found'
): Response {
  const errorResponse: ErrorResponse = {
    error:   true,
    code:    'not_found',
    message,
    details: {},
  };

  return res.status(404).json(errorResponse);
}
