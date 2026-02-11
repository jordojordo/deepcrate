import type {
  ApproveRequest,
  RejectRequest,
  QueueStats,
  QueueItem,
  PaginatedResponse,
  QueueFilters
} from '@/types';

import client from './api';

export async function getPending(filters: QueueFilters): Promise<PaginatedResponse<QueueItem>> {
  const params: Record<string, string | number | boolean> = {
    sort:   filters.sort,
    order:  filters.order,
    limit:  filters.limit,
    offset: filters.offset,
  };

  if (filters.source !== 'all') {
    params.source = filters.source;
  }

  if (filters.hide_in_library) {
    params.hide_in_library = true;
  }

  const response = await client.get<PaginatedResponse<QueueItem>>('/queue/pending', { params });

  return response.data;
}

export async function approve(request: ApproveRequest): Promise<void> {
  await client.post('/queue/approve', request);
}

export async function reject(request: RejectRequest): Promise<void> {
  await client.post('/queue/reject', request);
}

export async function getStats(): Promise<QueueStats> {
  const response = await client.get<{
    pending:   number;
    approved:  number;
    rejected:  number;
    inLibrary: number;
  }>('/queue/stats');

  return {
    pending:        response.data.pending,
    approved:       response.data.approved,
    rejected:       response.data.rejected,
    inLibrary:      response.data.inLibrary,
    approvedToday:  0, // TODO: Implement if needed
    totalProcessed: response.data.approved + response.data.rejected,
  };
}
