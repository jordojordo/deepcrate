import type { WebhookConfig, WebhookPayload } from '@server/types/webhook';

import {
  describe, it, expect, vi, beforeEach, afterEach
} from 'vitest';

import { getConfig } from '@server/config/settings';
import { HttpError } from '@server/utils/HttpError';
import { fetchJson } from '@server/utils/httpClient';
import {
  signPayload, buildPayload, sendWebhook, sendWithRetry, fireEvent
} from './WebhookService';

vi.mock('@server/utils/httpClient');

vi.mock('@server/config/logger', () => ({
  default: {
    info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn()
  }
}));

vi.mock('@server/config/settings', () => ({ getConfig: vi.fn() }));

const baseWebhook: WebhookConfig = {
  name:       'test-hook',
  enabled:    true,
  url:        'http://hook.test/callback',
  events:     ['download_completed'],
  timeout_ms: 5000,
  retry:      0,
};

const testPayload: WebhookPayload = {
  event:     'download_completed',
  timestamp: '2026-03-16T00:00:00.000Z',
  data:      { artist: 'Test Artist', album: 'Test Album' },
};

beforeEach(() => vi.clearAllMocks());
afterEach(() => vi.clearAllMocks());

describe('signPayload', () => {
  it('produces consistent HMAC-SHA256 hex digest', () => {
    const sig = signPayload('{"test":true}', 'secret123');

    expect(sig).toMatch(/^[a-f0-9]{64}$/);
    expect(signPayload('{"test":true}', 'secret123')).toBe(sig);
  });
});

describe('buildPayload', () => {
  it('constructs payload with ISO timestamp', () => {
    const payload = buildPayload('queue_approved', { artist: 'A', album: 'B' });

    expect(payload.event).toBe('queue_approved');
    expect(payload.data).toEqual({ artist: 'A', album: 'B' });
    expect(new Date(payload.timestamp).toISOString()).toBe(payload.timestamp);
  });
});

describe('sendWebhook', () => {
  it('returns success on 200', async() => {
    vi.mocked(fetchJson).mockResolvedValueOnce({ data: { ok: true }, status: 200 });

    const result = await sendWebhook(baseWebhook, testPayload);

    expect(result.success).toBe(true);
    expect(result.statusCode).toBe(200);
    expect(result.duration).toBeGreaterThanOrEqual(0);
  });

  it('returns failure on 500', async() => {
    vi.mocked(fetchJson).mockRejectedValueOnce(
      new HttpError('HTTP 500: Internal Server Error', 500)
    );

    const result = await sendWebhook(baseWebhook, testPayload);

    expect(result.success).toBe(false);
    expect(result.statusCode).toBe(500);
  });

  it('returns failure on timeout', async() => {
    vi.mocked(fetchJson).mockRejectedValueOnce(
      new DOMException('The operation was aborted', 'TimeoutError')
    );

    const result = await sendWebhook({ ...baseWebhook, timeout_ms: 100 }, testPayload);

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('includes X-Webhook-Signature header when secret is set', async() => {
    vi.mocked(fetchJson).mockResolvedValueOnce({ data: {}, status: 200 });

    await sendWebhook({ ...baseWebhook, secret: 'my-secret' }, testPayload);

    expect(fetchJson).toHaveBeenCalledWith(
      'http://hook.test/callback',
      expect.objectContaining({ headers: expect.objectContaining({ 'X-Webhook-Signature': expect.stringMatching(/^[a-f0-9]{64}$/) }) })
    );
  });
});

describe('sendWithRetry', () => {
  it('retries on failure with exponential backoff', async() => {
    vi.mocked(fetchJson)
      .mockRejectedValueOnce(new HttpError('HTTP 500', 500))
      .mockRejectedValueOnce(new HttpError('HTTP 500', 500))
      .mockResolvedValueOnce({ data: { ok: true }, status: 200 });

    const result = await sendWithRetry({ ...baseWebhook, retry: 2 }, testPayload);

    expect(result.success).toBe(true);
  }, 15000);

  it('returns failure after exhausting retries', async() => {
    vi.mocked(fetchJson)
      .mockRejectedValueOnce(new HttpError('HTTP 500', 500))
      .mockRejectedValueOnce(new HttpError('HTTP 500', 500))
      .mockRejectedValueOnce(new HttpError('HTTP 500', 500));

    const result = await sendWithRetry({ ...baseWebhook, retry: 2 }, testPayload);

    expect(result.success).toBe(false);
  }, 15000);
});

describe('fireEvent', () => {
  it('filters webhooks by event', async() => {
    vi.mocked(getConfig).mockReturnValue({
      webhooks: [
        { ...baseWebhook, events: ['download_completed'] },
        {
          ...baseWebhook, name: 'other', url: 'http://other.test/cb', events: ['queue_approved']
        },
      ],
    } as ReturnType<typeof getConfig>);

    vi.mocked(fetchJson).mockResolvedValueOnce({ data: {}, status: 200 });

    await fireEvent('download_completed', { artist: 'A' });

    expect(fetchJson).toHaveBeenCalledTimes(1);
    expect(fetchJson).toHaveBeenCalledWith(
      'http://hook.test/callback',
      expect.anything()
    );
  });

  it('skips disabled webhooks', async() => {
    vi.mocked(getConfig).mockReturnValue({
      webhooks: [
        { ...baseWebhook, enabled: false },
      ],
    } as ReturnType<typeof getConfig>);

    await fireEvent('download_completed', { artist: 'A' });

    expect(fetchJson).not.toHaveBeenCalled();
  });
});
