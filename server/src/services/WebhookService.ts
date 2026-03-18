import type { WebhookConfig, WebhookEvent, WebhookExecutionResult, WebhookPayload } from '@server/types/webhook';

import crypto from 'crypto';
import axios from 'axios';

import logger from '@server/config/logger';
import { getConfig } from '@server/config/settings';

export function signPayload(body: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(body).digest('hex');
}

export function buildPayload(
  event: WebhookEvent,
  data: WebhookPayload['data'],
): WebhookPayload {
  return {
    event,
    timestamp: new Date().toISOString(),
    data,
  };
}

export async function sendWebhook(
  webhook: WebhookConfig,
  payload: WebhookPayload,
): Promise<WebhookExecutionResult> {
  const body = JSON.stringify(payload);
  const start = Date.now();

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };

  if (webhook.secret) {
    headers['X-Webhook-Signature'] = signPayload(body, webhook.secret);
  }

  try {
    const response = await axios.post(webhook.url, payload, {
      headers,
      timeout: webhook.timeout_ms,
    });

    return {
      success:    true,
      statusCode: response.status,
      duration:   Date.now() - start,
    };
  } catch(error) {
    const duration = Date.now() - start;

    if (axios.isAxiosError(error)) {
      return {
        success:    false,
        statusCode: error.response?.status,
        duration,
        error:      error.message,
      };
    }

    return {
      success:  false,
      duration,
      error:    error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

export async function sendWithRetry(
  webhook: WebhookConfig,
  payload: WebhookPayload,
): Promise<WebhookExecutionResult> {
  let result = await sendWebhook(webhook, payload);

  for (let attempt = 1; attempt <= webhook.retry && !result.success; attempt += 1) {
    const delay = 1000 * Math.pow(2, attempt);

    logger.debug(`[webhook] ${ webhook.name } retry ${ attempt }/${ webhook.retry } in ${ delay }ms`);
    await new Promise((resolve) => setTimeout(resolve, delay));
    result = await sendWebhook(webhook, payload);
  }

  return result;
}

export async function fireEvent(
  event: WebhookEvent,
  data: WebhookPayload['data'],
): Promise<void> {
  const config = getConfig();
  const webhooks = config.webhooks.filter(
    (w) => w.enabled && w.events.includes(event),
  );

  if (webhooks.length === 0) {
    return;
  }

  const payload = buildPayload(event, data);

  const settled = await Promise.allSettled(
    webhooks.map((w) => sendWithRetry(w, payload)),
  );

  for (let i = 0; i < settled.length; i += 1) {
    const outcome = settled[i];
    const name    = webhooks[i].name;

    if (outcome.status === 'fulfilled') {
      const r = outcome.value;

      if (r.success) {
        logger.info(`[webhook] ${ name } fired ${ event } (status=${ r.statusCode }, ${ r.duration }ms)`);
      } else {
        logger.warn(`[webhook] ${ name } failed ${ event } (status=${ r.statusCode }, ${ r.duration }ms): ${ r.error }`);
      }
    } else {
      logger.error(`[webhook] ${ name } error firing ${ event }: ${ outcome.reason }`);
    }
  }
}
