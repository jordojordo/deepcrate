import { z } from 'zod';

import { registry } from '@server/openapi/registry';
import { security } from '@server/openapi/security';

const previewResponseSchema = z.object({
  url:       z.string().nullable(),
  source:    z.enum(['deezer', 'spotify']).nullable(),
  available: z.boolean(),
});

const albumPreviewResponseSchema = previewResponseSchema.extend({ selectedTrack: z.string().nullable() });

registry.registerPath({
  method:   'get',
  path:     '/preview',
  tags:     ['Preview'],
  summary:  'Get a track audio preview URL',
  security,
  request: {
    query: z.object({
      artist: z.string(),
      track:  z.string(),
    }),
  },
  responses: {
    200: {
      description: 'Preview URL',
      content:     { 'application/json': { schema: previewResponseSchema } },
    },
  },
});

registry.registerPath({
  method:   'get',
  path:     '/preview/album',
  tags:     ['Preview'],
  summary:  'Get an album audio preview URL',
  security,
  request: {
    query: z.object({
      artist:      z.string(),
      album:       z.string(),
      mbid:        z.string().optional(),
      sourceTrack: z.string().optional(),
    }),
  },
  responses: {
    200: {
      description: 'Album preview URL',
      content:     { 'application/json': { schema: albumPreviewResponseSchema } },
    },
  },
});
