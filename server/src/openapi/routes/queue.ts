import { z } from 'zod';

import { registry } from '@server/openapi/registry';
import { security } from '@server/openapi/security';
import { queueItemResponseSchema } from '@server/openapi/schemas';
import { errorResponseSchema, actionResponseSchema } from '@server/types/responses';
import { approveRequestSchema, rejectRequestSchema } from '@server/types/queue';

registry.registerPath({
  method:   'get',
  path:     '/queue/pending',
  tags:     ['Queue'],
  summary:  'Get pending queue items',
  security,
  request: {
    query: z.object({
      source:          z.enum(['all', 'listenbrainz', 'catalog']).default('all').optional(),
      sort:            z.enum(['added_at', 'score', 'artist', 'year']).default('added_at').optional(),
      order:           z.enum(['asc', 'desc']).default('desc').optional(),
      limit:           z.coerce.number().int().positive().default(50)
        .optional(),
      offset:          z.coerce.number().int().nonnegative().default(0)
        .optional(),
      hide_in_library: z.coerce.boolean().default(false).optional(),
      genres:          z.string().optional(),
    }),
  },
  responses: {
    200: {
      description: 'Paginated list of pending queue items',
      content:     {
        'application/json': {
          schema: z.object({
            items:  z.array(queueItemResponseSchema),
            total:  z.number().int().nonnegative(),
            limit:  z.number().int().positive(),
            offset: z.number().int().nonnegative(),
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
  method:    'get',
  path:      '/queue/genres',
  tags:      ['Queue'],
  summary:   'Get all available genres from queue items',
  security,
  responses: {
    200: {
      description: 'List of genres',
      content:     { 'application/json': { schema: z.object({ genres: z.array(z.string()) }) } },
    },
  },
});

registry.registerPath({
  method:    'get',
  path:      '/queue/stats',
  tags:      ['Queue'],
  summary:   'Get queue statistics by source',
  security,
  responses: {
    200: {
      description: 'Queue item counts per source',
      content:     {
        'application/json': {
          schema: z.object({
            listenbrainz: z.number().int().nonnegative(),
            catalog:      z.number().int().nonnegative(),
            total:        z.number().int().nonnegative(),
          }),
        },
      },
    },
  },
});

registry.registerPath({
  method:    'post',
  path:      '/queue/approve',
  tags:      ['Queue'],
  summary:   'Approve queue items for download',
  security,
  request:   { body: { content: { 'application/json': { schema: approveRequestSchema } } } },
  responses: {
    200: {
      description: 'Approval result',
      content:     { 'application/json': { schema: actionResponseSchema } },
    },
    400: {
      description: 'Validation error',
      content:     { 'application/json': { schema: errorResponseSchema } },
    },
  },
});

registry.registerPath({
  method:    'post',
  path:      '/queue/reject',
  tags:      ['Queue'],
  summary:   'Reject queue items',
  security,
  request:   { body: { content: { 'application/json': { schema: rejectRequestSchema } } } },
  responses: {
    200: {
      description: 'Rejection result',
      content:     { 'application/json': { schema: actionResponseSchema } },
    },
    400: {
      description: 'Validation error',
      content:     { 'application/json': { schema: errorResponseSchema } },
    },
  },
});
