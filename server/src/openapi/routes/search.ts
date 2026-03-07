import { z } from 'zod';

import { registry } from '@server/openapi/registry';
import { security } from '@server/openapi/security';
import { errorResponseSchema } from '@server/types/responses';
import { musicBrainzSearchResponseSchema } from '@server/types/search';

registry.registerPath({
  method:   'get',
  path:     '/search/musicbrainz',
  tags:     ['Search'],
  summary:  'Search MusicBrainz for albums, artists, or tracks',
  security,
  request: {
    query: z.object({
      q:     z.string(),
      type:  z.enum(['album', 'artist', 'track']),
      limit: z.coerce.number().int().positive().max(100)
        .default(20)
        .optional(),
    }),
  },
  responses: {
    200: {
      description: 'Search results',
      content:     { 'application/json': { schema: musicBrainzSearchResponseSchema } },
    },
    400: {
      description: 'Validation error',
      content:     { 'application/json': { schema: errorResponseSchema } },
    },
  },
});
