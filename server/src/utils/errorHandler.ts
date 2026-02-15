import type { Response } from 'express';
import type { ErrorResponse } from '@server/types/responses';

import { E_TIMEOUT } from 'async-mutex';
import axios from 'axios';

import logger from '@server/config/logger';
import { RETRYABLE_STATUS_CODES, TRANSIENT_ERROR_CODES } from '@server/constants/services';

/**
 * Custom error for database busy/locked conditions.
 */
export class DatabaseBusyError extends Error {
  constructor(message = 'Database is busy. Please try again.') {
    super(message);
    this.name = 'DatabaseBusyError';
  }
}

/**
 * Check if an error is a SQLite busy/locked error.
 *
 * Detects SQLITE_BUSY, SQLITE_LOCKED errors, async-mutex timeout errors,
 * and Sequelize TimeoutError wrapping SQLite busy conditions.
 */
export function isDatabaseBusyError(error: unknown): boolean {
  if (error instanceof DatabaseBusyError) {
    return true;
  }

  if (!(error instanceof Error)) {
    return false;
  }

  // async-mutex timeout (singleton comparison)
  if (error === E_TIMEOUT) {
    return true;
  }

  // Sequelize TimeoutError wrapping SQLITE_BUSY
  if (error.name === 'TimeoutError') {
    return true;
  }

  // Direct SQLite message (in case the error isn't wrapped)
  if (error.message === 'database is locked') {
    return true;
  }

  // Check cause.code for raw SqliteError reaching us unwrapped
  const cause = (error as { cause?: { code?: string } }).cause;

  if (cause?.code === 'SQLITE_BUSY' || cause?.code === 'SQLITE_LOCKED') {
    return true;
  }

  return false;
}

export function isTransientError(error: unknown): boolean {
  if (!axios.isAxiosError(error)) {
    return false;
  }

  if (error.response) {
    return RETRYABLE_STATUS_CODES.has(error.response.status);
  }

  const code = error.code || '';

  return TRANSIENT_ERROR_CODES.has(code) || code.startsWith('ERR_TLS');
}

/**
 * Send database busy error response (503 Service Unavailable).
 */
export function sendDatabaseBusyError(
  res: Response,
  message = 'Database is busy. Please try again later.'
): Response {
  const errorResponse: ErrorResponse = {
    error:   true,
    code:    'database_busy',
    message,
    details: {},
  };

  return res.status(503).json(errorResponse);
}

/**
 * Handle errors and send appropriate response
 */
export function handleError(
  res: Response,
  error: Error,
  defaultMessage = 'An unexpected error occurred.'
): Response {
  logger.error(`Error: ${ error.message }`, { stack: error.stack });

  // Check for database busy errors first
  if (isDatabaseBusyError(error)) {
    return sendDatabaseBusyError(res);
  }

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
