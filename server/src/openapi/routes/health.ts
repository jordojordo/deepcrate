import { registry } from '@server/openapi/registry';
import { healthResponseSchema } from '@server/types/responses';

registry.registerPath({
  method:    'get',
  path:      '/health',
  tags:      ['Health'],
  summary:   'Health check (mounted at root, not under /api/v1)',
  responses: {
    200: {
      description: 'Service is healthy',
      content:     { 'application/json': { schema: healthResponseSchema } },
    },
  },
});
