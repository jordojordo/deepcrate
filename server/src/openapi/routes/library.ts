import { z } from 'zod';

import { registry } from '@server/openapi/registry';
import { errorResponseSchema } from '@server/types/responses';
import { security } from '@server/openapi/security';

registry.registerPath({
  method:    'get',
  path:      '/library/stats',
  tags:      ['Library'],
  summary:   'Get library statistics',
  security,
  responses: {
    200: {
      description: 'Library stats',
      content:     {
        'application/json': {
          schema: z.object({
            totalAlbums:  z.number().int().nonnegative(),
            lastSyncedAt: z.string().nullable(),
          }),
        },
      },
    },
  },
});

registry.registerPath({
  method:    'post',
  path:      '/library/sync',
  tags:      ['Library'],
  summary:   'Trigger library sync from Subsonic server',
  security,
  responses: {
    200: {
      description: 'Sync triggered',
      content:     {
        'application/json': {
          schema: z.object({
            success: z.boolean(),
            message: z.string(),
          }),
        },
      },
    },
    500: {
      description: 'Sync failed',
      content:     { 'application/json': { schema: errorResponseSchema } },
    },
  },
});

registry.registerPath({
  method:    'post',
  path:      '/library/organize',
  tags:      ['Library'],
  summary:   'Trigger library organization',
  security,
  responses: {
    200: {
      description: 'Organization triggered',
      content:     {
        'application/json': {
          schema: z.object({
            success: z.boolean(),
            message: z.string(),
          }),
        },
      },
    },
    500: {
      description: 'Organization failed',
      content:     { 'application/json': { schema: errorResponseSchema } },
    },
  },
});

registry.registerPath({
  method:    'get',
  path:      '/library/organize/status',
  tags:      ['Library'],
  summary:   'Get library organization status',
  security,
  responses: {
    200: {
      description: 'Organization status',
      content:     {
        'application/json': {
          schema: z.object({
            enabled:     z.boolean(),
            configured:  z.boolean(),
            completed:   z.number().int().nonnegative(),
            unorganized: z.number().int().nonnegative(),
            organized:   z.number().int().nonnegative(),
          }),
        },
      },
    },
  },
});

registry.registerPath({
  method:    'get',
  path:      '/library/organize/config',
  tags:      ['Library'],
  summary:   'Get library organization configuration',
  security,
  responses: {
    200: {
      description: 'Organization configuration',
      content:     {
        'application/json': {
          schema: z.object({
            enabled:    z.boolean(),
            configured: z.boolean(),
            config:     z.record(z.string(), z.unknown()),
          }),
        },
      },
    },
  },
});

registry.registerPath({
  method:    'put',
  path:      '/library/organize/config',
  tags:      ['Library'],
  summary:   'Update library organization configuration',
  security,
  request:   { body: { content: { 'application/json': { schema: z.record(z.string(), z.unknown()) } } } },
  responses: {
    200: {
      description: 'Configuration updated',
      content:     {
        'application/json': {
          schema: z.object({
            enabled:    z.boolean(),
            configured: z.boolean(),
            config:     z.record(z.string(), z.unknown()),
          }),
        },
      },
    },
    400: {
      description: 'Validation error',
      content:     { 'application/json': { schema: errorResponseSchema } },
    },
  },
});

registry.registerPath({
  method:   'get',
  path:     '/library/organize/tasks',
  tags:     ['Library'],
  summary:  'Get library organization tasks',
  security,
  request: {
    query: z.object({
      limit:  z.coerce.number().int().positive().optional(),
      offset: z.coerce.number().int().nonnegative().optional(),
    }),
  },
  responses: {
    200: {
      description: 'Organization tasks',
      content:     {
        'application/json': {
          schema: z.object({
            items: z.array(z.object({
              id:          z.string(),
              artist:      z.string(),
              album:       z.string(),
              type:        z.string(),
              completedAt: z.string().nullable(),
            })),
            total: z.number().int().nonnegative(),
          }),
        },
      },
    },
  },
});
