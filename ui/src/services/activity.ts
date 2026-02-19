import type { ActivityItem } from '@/types';
import type { PaginatedResponse } from '@/types/api';

import client from './api';

export async function getRecent(limit = 10): Promise<ActivityItem[]> {
  const response = await client.get<PaginatedResponse<ActivityItem>>('/activity/recent', { params: { limit } });

  return response.data.items;
}

export async function getPaginated(params: { limit: number; offset: number }): Promise<PaginatedResponse<ActivityItem>> {
  const response = await client.get<PaginatedResponse<ActivityItem>>('/activity/recent', { params });

  return response.data;
}
