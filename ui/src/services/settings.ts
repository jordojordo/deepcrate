import type {
  SettingsResponse,
  UpdateResponse,
  SettingsSection,
} from '@/types';

import client from './api';

/**
 * Get all settings (secrets sanitized)
 */
export async function getAll(): Promise<SettingsResponse> {
  const response = await client.get<SettingsResponse>('/settings');

  return response.data;
}

/**
 * Update a settings section
 */
export async function updateSection<T extends object>(
  section: SettingsSection,
  data: T
): Promise<UpdateResponse> {
  const response = await client.put<UpdateResponse>(`/settings/${ section }`, data);

  return response.data;
}

/**
 * Validate settings without saving
 */
export async function validate<T extends object>(
  section: SettingsSection,
  data: T
): Promise<{ valid: boolean; errors?: Array<{ path: string; message: string }> }> {
  const response = await client.post<{
    valid:   boolean;
    errors?: Array<{ path: string; message: string }>;
  }>('/settings/validate', { section, data });

  return response.data;
}
