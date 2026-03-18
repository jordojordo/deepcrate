import type { WebhookConfig, WebhookPayload } from '@server/types/webhook';

import {
  describe, it, expect, vi, beforeEach, afterEach
} from 'vitest';
import nock from 'nock';

import { getConfig } from '@server/config/settings';
import {
  signPayload, buildPayload, sendWebhook, sendWithRetry, fireEvent
} from './WebhookService';

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

beforeEach(() => nock.cleanAll());
afterEach(() => nock.cleanAll());

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
    nock('http://hook.test').post('/callback').reply(200, { ok: true });

    const result = await sendWebhook(baseWebhook, testPayload);

    expect(result.success).toBe(true);
    expect(result.statusCode).toBe(200);
    expect(result.duration).toBeGreaterThanOrEqual(0);
  });

  it('returns failure on 500', async() => {
    nock('http://hook.test').post('/callback').reply(500, 'error');

    const result = await sendWebhook(baseWebhook, testPayload);

    expect(result.success).toBe(false);
    expect(result.statusCode).toBe(500);
  });

  it('returns failure on timeout', async() => {
    nock('http://hook.test').post('/callback').delay(6000).reply(200);

    const result = await sendWebhook({ ...baseWebhook, timeout_ms: 100 }, testPayload);

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('includes X-Webhook-Signature header when secret is set', async() => {
    const scope = nock('http://hook.test')
      .post('/callback')
      .matchHeader('X-Webhook-Signature', /^[a-f0-9]{64}$/)
      .reply(200);

    await sendWebhook({ ...baseWebhook, secret: 'my-secret' }, testPayload);

    expect(scope.isDone()).toBe(true);
  });
});

describe('sendWithRetry', () => {
  it('retries on failure with exponential backoff', async() => {
    nock('http://hook.test').post('/callback').reply(500);
    nock('http://hook.test').post('/callback').reply(500);
    nock('http://hook.test').post('/callback').reply(200);

    const result = await sendWithRetry({ ...baseWebhook, retry: 2 }, testPayload);

    expect(result.success).toBe(true);
  }, 15000);

  it('returns failure after exhausting retries', async() => {
    nock('http://hook.test').post('/callback').times(3).reply(500);

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

    const scope = nock('http://hook.test').post('/callback').reply(200);

    await fireEvent('download_completed', { artist: 'A' });

    expect(scope.isDone()).toBe(true);
  });

  it('skips disabled webhooks', async() => {
    vi.mocked(getConfig).mockReturnValue({
      webhooks: [
        { ...baseWebhook, enabled: false },
      ],
    } as ReturnType<typeof getConfig>);

    const scope = nock('http://hook.test').post('/callback').reply(200);

    await fireEvent('download_completed', { artist: 'A' });

    expect(scope.isDone()).toBe(false);
  });
});
