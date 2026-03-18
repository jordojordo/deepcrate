import type { Request, Response } from 'express';

import { z } from 'zod';

import logger from '@server/config/logger';
import { BaseController } from '@server/controllers/BaseController';
import { buildPayload, sendWebhook } from '@server/services/WebhookService';
import { sendValidationError } from '@server/utils/errorHandler';

const TestWebhookSchema = z.object({
  url:        z.url(),
  secret:     z.string().optional(),
  timeout_ms: z.number().int().positive().max(30000)
    .default(10000),
  dry_run: z.boolean().default(false),
});

class WebhookController extends BaseController {
  /**
   * With dry_run=true, returns the payload that would be sent without making an HTTP call.
   * POST /api/v1/webhooks/test
   */
  testWebhook = async(req: Request, res: Response): Promise<Response> => {
    try {
      const parseResult = TestWebhookSchema.safeParse(req.body);

      if (!parseResult.success) {
        const errors = parseResult.error.issues
          .map((issue) => `${ issue.path.join('.') }: ${ issue.message }`)
          .join('; ');

        return sendValidationError(res, `Invalid webhook configuration: ${ errors }`);
      }

      const body    = parseResult.data;
      const payload = buildPayload('download_completed', {
        artist: 'Test Artist',
        album:  'Test Album',
      });

      if (body.dry_run) {
        logger.info(`[webhook:test] Dry run: ${ JSON.stringify(payload) }`);

        return res.json({
          success: true,
          dry_run: true,
          payload,
        });
      }

      const result = await sendWebhook(
        {
          name:       'test',
          enabled:    true,
          url:        body.url,
          secret:     body.secret,
          events:     ['download_completed'],
          timeout_ms: body.timeout_ms,
          retry:      0,
        },
        payload,
      );

      return res.json(result);
    } catch(error) {
      return this.handleError(res, error as Error, 'Failed to test webhook');
    }
  };
}

export default new WebhookController();
