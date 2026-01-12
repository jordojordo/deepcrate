import { z } from 'zod';

/**
 * Queue item schema
 */
export const queueItemSchema = z.object({
  artist:       z.string(),
  album:        z.string().nullable().optional(),
  title:        z.string().nullable().optional(),
  mbid:         z.string(),
  type:         z.enum(['album', 'track']).default('album'),
  added_at:     z.date(),
  score:        z.number().nullable().optional(),
  source:       z.enum(['listenbrainz', 'catalog']),
  similar_to:   z.array(z.string()).nullable().optional(),
  source_track: z.string().nullable().optional(),
  cover_url:    z.string().nullable().optional(),
  year:         z.number().int().nullable().optional(),
});

export type QueueItem = z.infer<typeof queueItemSchema>;

/**
 * Approve request schema
 */
export const approveRequestSchema = z.object({
  mbids: z.array(z.string()).optional(),
  all:   z.boolean().default(false),
});

export type ApproveRequest = z.infer<typeof approveRequestSchema>;

/**
 * Reject request schema
 */
export const rejectRequestSchema = z.object({ mbids: z.array(z.string()) });

export type RejectRequest = z.infer<typeof rejectRequestSchema>;

/**
 * Query params for getting pending items
 */
export const getPendingQuerySchema = z.object({
  source: z.enum(['all', 'listenbrainz', 'catalog']).default('all'),
  sort:   z.enum(['added_at', 'score', 'artist', 'year']).default('added_at'),
  order:  z.enum(['asc', 'desc']).default('desc'),
  limit:  z.coerce.number().int().positive().default(50),
  offset: z.coerce.number().int().nonnegative().default(0),
});

export type GetPendingQuery = z.infer<typeof getPendingQuerySchema>;
