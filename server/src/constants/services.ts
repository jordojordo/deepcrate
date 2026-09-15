export const RETRYABLE_STATUS_CODES = new Set([
  429,  // Too Many Requests (rate limiting)
  503,  // Service Unavailable (MusicBrainz rate limiting)
]);

export const DEFAULT_MAX_RETRIES = 5;
export const DEFAULT_BASE_DELAY_MS = 1000;

/**
 * Minimum gap between outbound requests, per host. Only hosts that publish a rate limit belong here
 *
 * MusicBrainz enforces 1 req/sec per IP and rejects 100% of requests over that limit
 * https://musicbrainz.org/doc/MusicBrainz_API/Rate_Limiting
 */
export const HOST_MIN_INTERVAL_MS: Record<string, number> = {
  'musicbrainz.org':           1100,
  'api.listenbrainz.org':      1100,
  'labs.api.listenbrainz.org': 1100,
};
