import type { Request, Response, NextFunction } from 'express';
import { LRUCache } from 'lru-cache';

interface RateLimitConfig {
  windowMs:    number;
  maxRequests: number;
}

const cache = new LRUCache<string, number[]>({
  max: 10000,
  ttl: 60000, // 1 minute
});

/**
 * Simple rate limiter using LRU cache to track request timestamps.
 * Returns 429 if request limit is exceeded within the time window.
 */
export function rateLimit(config: RateLimitConfig) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const key = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || 'unknown';
    const now = Date.now();
    const timestamps = cache.get(key) || [];
    const windowStart = now - config.windowMs;

    const recentRequests = timestamps.filter(t => t > windowStart);

    if (recentRequests.length >= config.maxRequests) {
      res.status(429).json({
        success: false,
        error:   'Too many requests, please try again later',
      });

      return;
    }

    recentRequests.push(now);
    cache.set(key, recentRequests);
    next();
  };
}
