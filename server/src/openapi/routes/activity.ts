import { z } from 'zod';

import { registry } from '@server/openapi/registry';
import { activityItemSchema } from '@server/openapi/schemas';
import { security } from '@server/openapi/security';

registry.registerPath({
  method:   'get',
  path:     '/activity/recent',
  tags:     ['Activity'],
  summary:  'Get recent activity feed',
  security,
  request: {
    query: z.object({
      limit:  z.coerce.number().int().positive().max(50)
        .default(10)
        .optional(),
      offset: z.coerce.number().int().nonnegative().default(0)
        .optional(),
    }),
  },
  responses: {
    200: {
      description: 'Recent activity items',
      content:     {
        'application/json': {
          schema: z.object({
            items:  z.array(activityItemSchema),
            total:  z.number().int().nonnegative(),
            limit:  z.number().int().positive(),
            offset: z.number().int().nonnegative(),
          }),
        },
      },
    },
  },
});
