import { z } from 'zod';

import { registry } from '@server/openapi/registry';
import { errorResponseSchema } from '@server/types/responses';
import { security } from '@server/openapi/security';
import {
  jobStatusResponseSchema,
  triggerJobResponseSchema,
  cancelJobResponseSchema,
} from '@server/types/jobs';

registry.registerPath({
  method:    'get',
  path:      '/jobs/status',
  tags:      ['Jobs'],
  summary:   'Get status of all background jobs',
  security,
  responses: {
    200: {
      description: 'Job statuses',
      content:     { 'application/json': { schema: jobStatusResponseSchema } },
    },
  },
});

registry.registerPath({
  method:    'post',
  path:      '/jobs/{jobName}/trigger',
  tags:      ['Jobs'],
  summary:   'Manually trigger a background job',
  security,
  request:   { params: z.object({ jobName: z.string() }) },
  responses: {
    200: {
      description: 'Job triggered',
      content:     { 'application/json': { schema: triggerJobResponseSchema } },
    },
    404: {
      description: 'Job not found',
      content:     { 'application/json': { schema: errorResponseSchema } },
    },
  },
});

registry.registerPath({
  method:    'post',
  path:      '/jobs/{jobName}/cancel',
  tags:      ['Jobs'],
  summary:   'Cancel a running background job',
  security,
  request:   { params: z.object({ jobName: z.string() }) },
  responses: {
    200: {
      description: 'Job cancelled',
      content:     { 'application/json': { schema: cancelJobResponseSchema } },
    },
    404: {
      description: 'Job not found',
      content:     { 'application/json': { schema: errorResponseSchema } },
    },
  },
});
