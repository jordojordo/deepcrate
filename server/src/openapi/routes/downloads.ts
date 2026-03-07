import { z } from 'zod';

import { registry } from '@server/openapi/registry';
import { security } from '@server/openapi/security';
import { errorResponseSchema, actionResponseSchema } from '@server/types/responses';
import {
  activeDownloadSchema,
  completedDownloadSchema,
  failedDownloadSchema,
  downloadStatsSchema,
  searchResultsResponseSchema,
  selectResultRequestSchema,
  skipResultRequestSchema,
  retrySearchRequestSchema,
  getDownloadsQuerySchema,
} from '@server/types/downloads';

registry.registerPath({
  method:    'get',
  path:      '/downloads/active',
  tags:      ['Downloads'],
  summary:   'Get active downloads',
  security,
  request:   { query: getDownloadsQuerySchema.partial() },
  responses: {
    200: {
      description: 'Active downloads list',
      content:     {
        'application/json': {
          schema: z.object({
            items:  z.array(activeDownloadSchema),
            total:  z.number().int().nonnegative(),
            limit:  z.number().int().positive(),
            offset: z.number().int().nonnegative(),
          }),
        },
      },
    },
  },
});

registry.registerPath({
  method:    'get',
  path:      '/downloads/completed',
  tags:      ['Downloads'],
  summary:   'Get completed downloads',
  security,
  request:   { query: getDownloadsQuerySchema.partial() },
  responses: {
    200: {
      description: 'Completed downloads list',
      content:     {
        'application/json': {
          schema: z.object({
            items:  z.array(completedDownloadSchema),
            total:  z.number().int().nonnegative(),
            limit:  z.number().int().positive(),
            offset: z.number().int().nonnegative(),
          }),
        },
      },
    },
  },
});

registry.registerPath({
  method:    'get',
  path:      '/downloads/failed',
  tags:      ['Downloads'],
  summary:   'Get failed downloads',
  security,
  request:   { query: getDownloadsQuerySchema.partial() },
  responses: {
    200: {
      description: 'Failed downloads list',
      content:     {
        'application/json': {
          schema: z.object({
            items:  z.array(failedDownloadSchema),
            total:  z.number().int().nonnegative(),
            limit:  z.number().int().positive(),
            offset: z.number().int().nonnegative(),
          }),
        },
      },
    },
  },
});

registry.registerPath({
  method:    'post',
  path:      '/downloads/retry',
  tags:      ['Downloads'],
  summary:   'Retry failed downloads',
  security,
  request:   { body: { content: { 'application/json': { schema: z.object({ ids: z.array(z.uuid()) }) } } } },
  responses: {
    200: {
      description: 'Retry result',
      content:     { 'application/json': { schema: actionResponseSchema } },
    },
    400: {
      description: 'Validation error',
      content:     { 'application/json': { schema: errorResponseSchema } },
    },
  },
});

registry.registerPath({
  method:    'delete',
  path:      '/downloads/',
  tags:      ['Downloads'],
  summary:   'Delete download records',
  security,
  request:   { body: { content: { 'application/json': { schema: z.object({ ids: z.array(z.uuid()) }) } } } },
  responses: {
    200: {
      description: 'Delete result',
      content:     { 'application/json': { schema: actionResponseSchema } },
    },
    400: {
      description: 'Validation error',
      content:     { 'application/json': { schema: errorResponseSchema } },
    },
  },
});

registry.registerPath({
  method:    'get',
  path:      '/downloads/stats',
  tags:      ['Downloads'],
  summary:   'Get download statistics',
  security,
  responses: {
    200: {
      description: 'Download statistics',
      content:     { 'application/json': { schema: downloadStatsSchema } },
    },
  },
});

registry.registerPath({
  method:    'get',
  path:      '/downloads/{id}/search-results',
  tags:      ['Downloads'],
  summary:   'Get search results for a download task',
  security,
  request:   { params: z.object({ id: z.uuid() }) },
  responses: {
    200: {
      description: 'Search results for selection',
      content:     { 'application/json': { schema: searchResultsResponseSchema } },
    },
    404: {
      description: 'Download task not found',
      content:     { 'application/json': { schema: errorResponseSchema } },
    },
  },
});

registry.registerPath({
  method:   'post',
  path:     '/downloads/{id}/select',
  tags:     ['Downloads'],
  summary:  'Select a search result for download',
  security,
  request: {
    params: z.object({ id: z.uuid() }),
    body:   { content: { 'application/json': { schema: selectResultRequestSchema } } },
  },
  responses: {
    200: {
      description: 'Selection result',
      content:     { 'application/json': { schema: actionResponseSchema } },
    },
    404: {
      description: 'Download task not found',
      content:     { 'application/json': { schema: errorResponseSchema } },
    },
  },
});

registry.registerPath({
  method:   'post',
  path:     '/downloads/{id}/skip',
  tags:     ['Downloads'],
  summary:  'Skip a search result',
  security,
  request: {
    params: z.object({ id: z.uuid() }),
    body:   { content: { 'application/json': { schema: skipResultRequestSchema } } },
  },
  responses: {
    200: {
      description: 'Skip result',
      content:     { 'application/json': { schema: actionResponseSchema } },
    },
    404: {
      description: 'Download task not found',
      content:     { 'application/json': { schema: errorResponseSchema } },
    },
  },
});

registry.registerPath({
  method:   'post',
  path:     '/downloads/{id}/retry-search',
  tags:     ['Downloads'],
  summary:  'Retry search for a download task',
  security,
  request: {
    params: z.object({ id: z.uuid() }),
    body:   { content: { 'application/json': { schema: retrySearchRequestSchema } } },
  },
  responses: {
    200: {
      description: 'Retry search result',
      content:     { 'application/json': { schema: actionResponseSchema } },
    },
    404: {
      description: 'Download task not found',
      content:     { 'application/json': { schema: errorResponseSchema } },
    },
  },
});

registry.registerPath({
  method:    'post',
  path:      '/downloads/{id}/auto-select',
  tags:      ['Downloads'],
  summary:   'Auto-select best search result for download',
  security,
  request:   { params: z.object({ id: z.uuid() }) },
  responses: {
    200: {
      description: 'Auto-selection result',
      content:     { 'application/json': { schema: actionResponseSchema } },
    },
    404: {
      description: 'Download task not found',
      content:     { 'application/json': { schema: errorResponseSchema } },
    },
  },
});
