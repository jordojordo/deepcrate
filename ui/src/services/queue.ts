import type { QueueItem, PaginatedResponse, QueueFilters } from '@/types'

import client from './api'

export interface ApproveRequest {
  mbids: string[]
}

export interface RejectRequest {
  mbids: string[]
}

export interface QueueStats {
  pending: number
  approvedToday: number
  totalProcessed: number
}

export async function getPending(filters: QueueFilters): Promise<PaginatedResponse<QueueItem>> {
  const params: Record<string, string | number> = {
    sort: filters.sort,
    order: filters.order,
    limit: filters.limit,
    offset: filters.offset,
  }

  if (filters.source !== 'all') {
    params.source = filters.source
  }

  const response = await client.get<PaginatedResponse<QueueItem>>('/queue/pending', { params })
  return response.data
}

export async function approve(request: ApproveRequest): Promise<void> {
  await client.post('/queue/approve', request)
}

export async function reject(request: RejectRequest): Promise<void> {
  await client.post('/queue/reject', request)
}

export async function getStats(): Promise<QueueStats> {
  // Use getPending to calculate stats
  const pendingResponse = await getPending({
    source: 'all',
    sort: 'added_at',
    order: 'desc',
    limit: 1,
    offset: 0,
  })

  return {
    pending: pendingResponse.total,
    approvedToday: 0, // This would need a separate API endpoint
    totalProcessed: 0, // This would need a separate API endpoint
  }
}
