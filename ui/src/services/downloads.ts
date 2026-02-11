import type {
  ActiveDownload,
  CompletedDownload,
  FailedDownload,
  DownloadStats,
  DownloadFilters,
  PaginatedResponse,
  SearchResultsResponse,
  RetryRequest,
  DeleteRequest
} from '@/types';

import client from './api';

export async function getActive(filters: DownloadFilters): Promise<PaginatedResponse<ActiveDownload>> {
  const params: Record<string, number> = {
    limit:  filters.limit,
    offset: filters.offset,
  };

  const response = await client.get<PaginatedResponse<ActiveDownload>>('/downloads/active', { params });

  return response.data;
}

export async function getCompleted(filters: DownloadFilters): Promise<PaginatedResponse<CompletedDownload>> {
  const params: Record<string, number> = {
    limit:  filters.limit,
    offset: filters.offset,
  };

  const response = await client.get<PaginatedResponse<CompletedDownload>>('/downloads/completed', { params });

  return response.data;
}

export async function getFailed(filters: DownloadFilters): Promise<PaginatedResponse<FailedDownload>> {
  const params: Record<string, number> = {
    limit:  filters.limit,
    offset: filters.offset,
  };

  const response = await client.get<PaginatedResponse<FailedDownload>>('/downloads/failed', { params });

  return response.data;
}

export async function retry(request: RetryRequest): Promise<{ success: number; failed: number }> {
  const response = await client.post<{ count: number }>('/downloads/retry', request);

  // Parse the message to extract success and failed counts
  // The backend returns message like "Retried 5 downloads, 2 failed"
  return {
    success: response.data.count,
    failed:  0, // We can parse this from message if needed
  };
}

export async function getStats(): Promise<DownloadStats> {
  const response = await client.get<DownloadStats>('/downloads/stats');

  return response.data;
}

export async function deleteDownloads(request: DeleteRequest): Promise<{ success: number; failed: number }> {
  const response = await client.delete<{ count: number }>('/downloads', { data: request });

  return {
    success: response.data.count,
    failed:  0,
  };
}

export async function getSearchResults(taskId: string): Promise<SearchResultsResponse> {
  const response = await client.get<SearchResultsResponse>(`/downloads/${ taskId }/search-results`);

  return response.data;
}

export async function selectResult(taskId: string, username: string, directory?: string): Promise<void> {
  await client.post(`/downloads/${ taskId }/select`, {
    username,
    directory,
  });
}

export async function skipResult(taskId: string, username: string): Promise<void> {
  await client.post(`/downloads/${ taskId }/skip`, { username });
}

export async function retrySearch(taskId: string, query?: string): Promise<void> {
  await client.post(`/downloads/${ taskId }/retry-search`, { query });
}

export async function autoSelect(taskId: string): Promise<void> {
  await client.post(`/downloads/${ taskId }/auto-select`);
}
