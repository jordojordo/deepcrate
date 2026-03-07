import { z } from 'zod';

import { registry } from '@server/openapi/registry';
import { security } from '@server/openapi/security';
import { errorResponseSchema } from '@server/types/responses';
import {
  wishlistResponseSchema,
  paginatedWishlistResponseSchema,
  addToWishlistResponseSchema,
  deleteFromWishlistResponseSchema,
  updateWishlistItemResponseSchema,
  bulkOperationResponseSchema,
  importResponseSchema,
  wishlistSortSchema,
} from '@server/types/wishlist';

registry.registerPath({
  method:    'get',
  path:      '/wishlist',
  tags:      ['Wishlist'],
  summary:   'Get all wishlist entries',
  security,
  responses: {
    200: {
      description: 'Wishlist entries',
      content:     { 'application/json': { schema: wishlistResponseSchema } },
    },
  },
});

registry.registerPath({
  method:   'post',
  path:     '/wishlist',
  tags:     ['Wishlist'],
  summary:  'Add item to wishlist',
  security,
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({
            artist: z.string(),
            title:  z.string(),
            type:   z.enum(['album', 'track', 'artist']),
            year:   z.number().int().positive().optional(),
            mbid:   z.string().optional(),
          }),
        },
      },
    },
  },
  responses: {
    201: {
      description: 'Item added to wishlist',
      content:     { 'application/json': { schema: addToWishlistResponseSchema } },
    },
    400: {
      description: 'Validation error',
      content:     { 'application/json': { schema: errorResponseSchema } },
    },
  },
});

registry.registerPath({
  method:   'get',
  path:     '/wishlist/paginated',
  tags:     ['Wishlist'],
  summary:  'Get paginated wishlist entries with download status',
  security,
  request: {
    query: z.object({
      source:    z.enum(['listenbrainz', 'catalog', 'manual']).optional(),
      type:      z.enum(['album', 'track', 'artist']).optional(),
      processed: z.enum(['all', 'pending', 'processed']).optional(),
      dateFrom:  z.string().optional(),
      dateTo:    z.string().optional(),
      search:    z.string().optional(),
      sort:      wishlistSortSchema.optional(),
      limit:     z.coerce.number().int().positive().max(100)
        .optional(),
      offset: z.coerce.number().int().nonnegative().optional(),
    }),
  },
  responses: {
    200: {
      description: 'Paginated wishlist with download status',
      content:     { 'application/json': { schema: paginatedWishlistResponseSchema } },
    },
  },
});

registry.registerPath({
  method:   'get',
  path:     '/wishlist/export',
  tags:     ['Wishlist'],
  summary:  'Export wishlist entries',
  security,
  request: {
    query: z.object({
      format: z.enum(['json']),
      ids:    z.string().optional(),
    }),
  },
  responses: {
    200: {
      description: 'Exported wishlist data',
      content:     { 'application/json': { schema: z.object({}) } },
    },
  },
});

registry.registerPath({
  method:   'post',
  path:     '/wishlist/import',
  tags:     ['Wishlist'],
  summary:  'Import items to wishlist',
  security,
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({
            items: z.array(z.object({
              artist:   z.string(),
              title:    z.string(),
              type:     z.enum(['album', 'track', 'artist']),
              year:     z.number().int().positive().optional()
                .nullable(),
              mbid:     z.string().optional().nullable(),
              source:   z.enum(['listenbrainz', 'catalog', 'manual']).optional().nullable(),
              coverUrl: z.url().optional().nullable(),
            })),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Import results',
      content:     { 'application/json': { schema: importResponseSchema } },
    },
    400: {
      description: 'Validation error',
      content:     { 'application/json': { schema: errorResponseSchema } },
    },
  },
});

registry.registerPath({
  method:    'delete',
  path:      '/wishlist/bulk',
  tags:      ['Wishlist'],
  summary:   'Bulk delete wishlist entries',
  security,
  request:   { body: { content: { 'application/json': { schema: z.object({ ids: z.array(z.uuid()) }) } } } },
  responses: {
    200: {
      description: 'Bulk delete result',
      content:     { 'application/json': { schema: bulkOperationResponseSchema } },
    },
    400: {
      description: 'Validation error',
      content:     { 'application/json': { schema: errorResponseSchema } },
    },
  },
});

registry.registerPath({
  method:    'post',
  path:      '/wishlist/requeue',
  tags:      ['Wishlist'],
  summary:   'Bulk requeue wishlist entries for download',
  security,
  request:   { body: { content: { 'application/json': { schema: z.object({ ids: z.array(z.uuid()) }) } } } },
  responses: {
    200: {
      description: 'Requeue result',
      content:     { 'application/json': { schema: bulkOperationResponseSchema } },
    },
    400: {
      description: 'Validation error',
      content:     { 'application/json': { schema: errorResponseSchema } },
    },
  },
});

registry.registerPath({
  method:   'put',
  path:     '/wishlist/{id}',
  tags:     ['Wishlist'],
  summary:  'Update a wishlist item',
  security,
  request: {
    params: z.object({ id: z.uuid() }),
    body:   {
      content: {
        'application/json': {
          schema: z.object({
            artist:             z.string().min(1).optional(),
            title:              z.string().optional(),
            type:               z.enum(['album', 'track', 'artist']).optional(),
            year:               z.number().int().positive().optional()
              .nullable(),
            mbid:               z.string().optional().nullable(),
            source:             z.enum(['listenbrainz', 'catalog', 'manual']).optional().nullable(),
            coverUrl:           z.url().optional().nullable(),
            resetDownloadState: z.boolean().optional(),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Updated wishlist item',
      content:     { 'application/json': { schema: updateWishlistItemResponseSchema } },
    },
    404: {
      description: 'Item not found',
      content:     { 'application/json': { schema: errorResponseSchema } },
    },
  },
});

registry.registerPath({
  method:    'delete',
  path:      '/wishlist/{id}',
  tags:      ['Wishlist'],
  summary:   'Delete a wishlist item',
  security,
  request:   { params: z.object({ id: z.uuid() }) },
  responses: {
    200: {
      description: 'Delete result',
      content:     { 'application/json': { schema: deleteFromWishlistResponseSchema } },
    },
    404: {
      description: 'Item not found',
      content:     { 'application/json': { schema: errorResponseSchema } },
    },
  },
});
