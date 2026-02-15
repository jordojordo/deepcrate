export const TRANSIENT_ERROR_CODES = new Set([
  'ECONNRESET',
  'ECONNREFUSED',
  'ETIMEDOUT',
  'ENOTFOUND',
  'EADDRINUSE',
  'EHOSTUNREACH',
  'EAI_AGAIN',
  'EPIPE'
]);

export const RETRYABLE_STATUS_CODES = new Set([
  429,  // Too Many Requests (rate limiting)
  503,  // Service Unavailable (MusicBrainz rate limiting)
]);

export const DEFAULT_MAX_RETRIES   = 3;
export const DEFAULT_BASE_DELAY_MS = 2000;
