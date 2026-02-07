import type {
  LibraryOrganizeConfig,
  LibraryOrganizeStatus,
  LibrarySyncStats,
  PaginatedUnorganizedTasks,
} from '@/types';

import client from './api';

export async function getOrganizeStatus(): Promise<LibraryOrganizeStatus> {
  const response = await client.get<LibraryOrganizeStatus>('/library/organize/status');

  return response.data;
}

export async function getOrganizeConfig(): Promise<LibraryOrganizeConfig> {
  const response = await client.get<LibraryOrganizeConfig>('/library/organize/config');

  return response.data;
}

export async function updateOrganizeConfig(config: LibraryOrganizeConfig): Promise<LibraryOrganizeConfig> {
  const response = await client.put<LibraryOrganizeConfig>('/library/organize/config', config);

  return response.data;
}

export async function getUnorganizedTasks(limit: number, offset: number): Promise<PaginatedUnorganizedTasks> {
  const response = await client.get<PaginatedUnorganizedTasks>('/library/organize/tasks', { params: { limit, offset } });

  return response.data;
}

export async function triggerOrganize(): Promise<{ success: boolean; message: string }> {
  const response = await client.post<{ success: boolean; message: string }>('/library/organize');

  return response.data;
}

export async function getSyncStats(): Promise<LibrarySyncStats> {
  const response = await client.get<LibrarySyncStats>('/library/stats');

  return response.data;
}

export async function triggerSync(): Promise<{ success: boolean; message: string }> {
  const response = await client.post<{ success: boolean; message: string }>('/library/sync');

  return response.data;
}

