import type { Socket } from 'socket.io';
import type { ExtendedError } from 'socket.io/dist/namespace';

import crypto from 'crypto';
import logger from '@server/config/logger';
import { getConfig } from '@server/config/settings';

/**
 * Create Socket.io authentication middleware
 * Reuses the same auth logic from the Express middleware
 */
export function createAuthMiddleware() {
  return (socket: Socket, next: (_err?: ExtendedError) => void) => {
    const config = getConfig();
    const authSettings = config.ui?.auth;

    // If auth is disabled, allow all connections
    if (!authSettings?.enabled) {
      next();

      return;
    }

    // Get auth token from socket handshake
    const auth = socket.handshake.auth as { token?: string } | undefined;
    const token = auth?.token;

    if (!token) {
      logger.debug('[socket:auth] No token provided');
      next(new Error('Authentication required'));

      return;
    }

    let isValid = false;

    switch (authSettings.type) {
      case 'basic':
        isValid = validateBasicAuth(token, authSettings.username || '', authSettings.password || '');
        break;

      case 'api_key':
        isValid = validateApiKeyAuth(token, authSettings.api_key || '');
        break;

      case 'proxy':
        // For proxy auth, we trust the connection if a token is present
        // In production, the reverse proxy should handle auth
        isValid = Boolean(token);
        break;

      default:
        isValid = false;
    }

    if (!isValid) {
      logger.debug('[socket:auth] Invalid credentials');
      next(new Error('Invalid credentials'));

      return;
    }

    logger.debug('[socket:auth] Connection authenticated');
    next();
  };
}

/**
 * Validate Basic auth credentials
 * Token format: "Basic base64(username:password)" or just "base64(username:password)"
 */
function validateBasicAuth(token: string, expectedUsername: string, expectedPassword: string): boolean {
  try {
    // Strip "Basic " prefix if present
    const encoded = token.startsWith('Basic ') ? token.slice(6) : token;
    const decoded = Buffer.from(encoded, 'base64').toString('utf-8');
    const colonIndex = decoded.indexOf(':');

    if (colonIndex === -1) {
      return false;
    }

    const username = decoded.slice(0, colonIndex);
    const password = decoded.slice(colonIndex + 1);

    const usernameValid = timingSafeEqual(username, expectedUsername);
    const passwordValid = timingSafeEqual(password, expectedPassword);

    return usernameValid && passwordValid;
  } catch {
    return false;
  }
}

/**
 * Validate API key auth
 * Token format: "Bearer <key>" or just "<key>"
 */
function validateApiKeyAuth(token: string, expectedKey: string): boolean {
  const key = token.startsWith('Bearer ') ? token.slice(7) : token;

  return timingSafeEqual(key, expectedKey);
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
