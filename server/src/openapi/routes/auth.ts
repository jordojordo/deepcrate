import { registry } from '@server/openapi/registry';
import { authInfoResponseSchema, authMeResponseSchema } from '@server/types/responses';

registry.registerPath({
  method:    'get',
  path:      '/auth/info',
  tags:      ['Auth'],
  summary:   'Get authentication configuration (public)',
  responses: {
    200: {
      description: 'Authentication info',
      content:     { 'application/json': { schema: authInfoResponseSchema } },
    },
  },
});

registry.registerPath({
  method:    'get',
  path:      '/auth/me',
  tags:      ['Auth'],
  summary:   'Get current authenticated user',
  security:  [{ bearerAuth: [] }, { basicAuth: [] }, { apiKeyHeader: [] }],
  responses: {
    200: {
      description: 'Current user info',
      content:     { 'application/json': { schema: authMeResponseSchema } },
    },
    401: { description: 'Unauthorized' },
  },
});
