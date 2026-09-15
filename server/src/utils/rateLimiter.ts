import { HOST_MIN_INTERVAL_MS } from '@server/constants/services';

const queues = new Map<string, Promise<void>>();
const lastSentAt = new Map<string, number>();
const blockedUntil = new Map<string, number>();

export class HostBlockedError extends Error {
  constructor(
    public readonly host: string,
    public readonly remainingMs: number,
  ) {
    super(`${ host } asked us to back off for another ${ Math.ceil(remainingMs / 1000) }s`);
    this.name = 'HostBlockedError';
  }
}

function hostOf(url: string): string | null {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

function abortableSleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Request aborted', 'AbortError'));

      return;
    }

    const onAbort = () => {
      clearTimeout(timer);
      reject(new DOMException('Request aborted', 'AbortError'));
    };

    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);

    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

async function waitUntilReady(
  host: string,
  readyAt: () => number,
  signal?: AbortSignal,
  maxBlockWaitMs?: number,
): Promise<void> {
  let wait = readyAt() - Date.now();

  while (wait > 0) {
    const blockRemaining = (blockedUntil.get(host) ?? 0) - Date.now();

    if (maxBlockWaitMs !== undefined && blockRemaining > maxBlockWaitMs) {
      throw new HostBlockedError(host, blockRemaining);
    }

    await abortableSleep(wait, signal);
    wait = readyAt() - Date.now();
  }
}

/**
 * Resolve once it is safe to issue a request to this host.
 *
 * Hosts without a published limit are not paced, but still honour a backoff
 * set by `blockHost` (e.g. a 429 with Retry-After from Spotify or Last.fm).
 *
 * @throws DOMException('AbortError') if `signal` fires while queued.
 * @throws HostBlockedError if the host's backoff exceeds `maxBlockWaitMs`.
 */
export async function acquireHostSlot(url: string, signal?: AbortSignal, maxBlockWaitMs?: number): Promise<void> {
  const host = hostOf(url);

  if (!host) {
    return;
  }

  const minInterval = HOST_MIN_INTERVAL_MS[host];
  const blockEnd = () => blockedUntil.get(host) ?? 0;

  if (!minInterval) {
    return waitUntilReady(host, blockEnd, signal, maxBlockWaitMs);
  }

  const previous = queues.get(host) ?? Promise.resolve();

  const slot = previous.then(async() => {
    await waitUntilReady(host, () => Math.max((lastSentAt.get(host) ?? 0) + minInterval, blockEnd()), signal, maxBlockWaitMs);

    lastSentAt.set(host, Date.now());
  });

  queues.set(host, slot.catch(() => undefined));

  return slot;
}

export function blockHost(url: string, ms: number): void {
  const host = hostOf(url);

  if (!host || !(ms > 0)) {
    return;
  }

  const until = Date.now() + ms;

  blockedUntil.set(host, Math.max(blockedUntil.get(host) ?? 0, until));
}

export function retryAfterMs(headers: Record<string, string>): number | undefined {
  const retryAfter = headers['retry-after']?.trim();

  if (retryAfter) {
    if (/^\d+(\.\d+)?$/.test(retryAfter)) {
      return Number(retryAfter) * 1000;
    }

    const date = Date.parse(retryAfter);

    if (!Number.isNaN(date)) {
      return Math.max(0, date - Date.now());
    }
  }

  const resetIn = headers['x-ratelimit-reset-in']?.trim();

  return resetIn && Number.isFinite(Number(resetIn)) ? Number(resetIn) * 1000 : undefined;
}

export function resetRateLimiter(): void {
  queues.clear();
  lastSentAt.clear();
  blockedUntil.clear();
}
