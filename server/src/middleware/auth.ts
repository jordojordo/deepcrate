import type { Request, Response, NextFunction } from 'express';
import type { AuthSettings } from '@server/config/settings';

import crypto from 'crypto';
import logger from '@server/config/logger';
import { getConfig } from '@server/config/settings';

// const EXCLUDED_PATHS = new Set(['/health', '/docs', '/openapi.json', '/redoc']);

/**
 * Auth middleware for protecting API routes
 */
export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const config = getConfig();
  const authSettings = config.ui?.auth;

  // If auth is disabled, allow all requests
  if (!authSettings?.enabled) {
    next();

    return;
  }

  // Validate based on auth type
  let isValid = false;

  switch (authSettings.type) {
    case 'basic':
      isValid = validateBasicAuth(req, authSettings);
      if (!isValid) {
        sendUnauthorized(res, 'Basic');

        return;
      }
      break;

    case 'api_key':
      isValid = validateApiKeyAuth(req, authSettings);
      if (!isValid) {
        sendUnauthorized(res, 'Bearer');

        return;
      }
      break;

    case 'proxy':
      isValid = validateProxyAuth(req);
      if (!isValid) {
        sendUnauthorized(res);

        return;
      }
      break;

    default:
      // Unknown auth type, deny access
      sendUnauthorized(res);

      return;
  }

  next();
}

/**
 * Validate Basic authentication
 */
function validateBasicAuth(req: Request, authSettings: AuthSettings): boolean {
  const authHeader = req.headers.authorization || '';

  if (!authHeader.startsWith('Basic ')) {
    return false;
  }

  try {
    const encoded = authHeader.slice(6);
    const decoded = Buffer.from(encoded, 'base64').toString('utf-8');
    const colonIndex = decoded.indexOf(':');

    if (colonIndex === -1) {
      return false;
    }

    const username = decoded.slice(0, colonIndex);
    const password = decoded.slice(colonIndex + 1);

    const expectedUsername = authSettings.username || '';
    const expectedPassword = authSettings.password || '';

    const usernameValid = timingSafeEqual(username, expectedUsername);
    const passwordValid = timingSafeEqual(password, expectedPassword);

    return usernameValid && passwordValid;
  } catch(error) {
    logger.error('[auth] Error validating Basic auth:', error);

    return false;
  }
}

/**
 * Validate API key authentication via Bearer token or X-API-Key header
 */
function validateApiKeyAuth(req: Request, authSettings: AuthSettings): boolean {
  const expectedKey = authSettings.api_key || '';

  // Check Bearer token
  const authHeader = req.headers.authorization || '';

  if (authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7);

    if (timingSafeEqual(token, expectedKey)) {
      return true;
    }
  }

  // Check X-API-Key header
  const apiKeyHeader = req.headers['x-api-key'] as string;

  if (apiKeyHeader && timingSafeEqual(apiKeyHeader, expectedKey)) {
    return true;
  }

  return false;
}

/**
 * Validate proxy authentication via Remote-User header
 */
function validateProxyAuth(req: Request): boolean {
  const remoteUser = req.headers['remote-user'] as string;

  return Boolean(remoteUser);
}

/**
 * Timing-safe string comparison to prevent timing attacks
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    // Still do a comparison to prevent timing leaks
    const bufA = Buffer.from(a, 'utf-8');
    const bufB = Buffer.from('x'.repeat(a.length), 'utf-8');

    crypto.timingSafeEqual(bufA, bufB);

    return false;
  }

  const bufA = Buffer.from(a, 'utf-8');
  const bufB = Buffer.from(b, 'utf-8');

  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Send 401 Unauthorized response
 */
function sendUnauthorized(res: Response, scheme?: string): void {
  const headers: Record<string, string> = {};

  if (scheme) {
    headers['WWW-Authenticate'] = scheme;
  }

  res.status(401).json({
    error:   true,
    code:    'unauthorized',
    message: 'Authentication required',
    details: {},
  });

  // Set headers after sending JSON
  Object.entries(headers).forEach(([key, value]) => {
    res.setHeader(key, value);
  });
}
