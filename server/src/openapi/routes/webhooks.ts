import { registry } from '@server/openapi/registry';
import { security } from '@server/openapi/security';
import {
  testWebhookRequestSchema,
  webhookExecutionResultSchema,
  testWebhookDryRunResponseSchema,
} from '@server/openapi/schemas';
import { errorResponseSchema } from '@server/types/responses';

registry.registerPath({
  method:  'post',
  path:    '/webhooks/test',
  tags:    ['Webhooks'],
  summary: 'Test a webhook endpoint',
  description:
    'Sends a test payload to the given URL. ' +
    'With `dry_run: true`, returns the payload without making an HTTP call.',
  security,
  request:   { body: { content: { 'application/json': { schema: testWebhookRequestSchema } } } },
  responses: {
    200: {
      description: 'Test result (execution result or dry-run payload)',
      content:     { 'application/json': { schema: webhookExecutionResultSchema.or(testWebhookDryRunResponseSchema) } },
    },
    400: {
      description: 'Validation error',
      content:     { 'application/json': { schema: errorResponseSchema } },
    },
  },
});
