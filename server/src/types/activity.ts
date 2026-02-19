import { z } from 'zod';

export type ActivityType = 'added' | 'approved' | 'rejected' | 'downloaded' | 'queued';

export interface ActivityItem {
  id:          string;
  title:       string;
  description: string;
  timestamp:   string;
  type:        ActivityType;
  coverUrl?:   string;
}

export const getRecentQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(50)
    .default(10),
  offset: z.coerce.number().int().nonnegative().default(0),
});

export type GetRecentQuery = z.infer<typeof getRecentQuerySchema>;
