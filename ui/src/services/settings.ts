import type {
  SettingsResponse,
  SectionResponse,
  UpdateResponse,
  SettingsSection,
} from '@/types/settings';

import client from './api';

/**
 * Get all settings (secrets sanitized)
 */
export async function getAll(): Promise<SettingsResponse> {
  const response = await client.get<SettingsResponse>('/settings');

  return response.data;
}

/**
 * Get a single settings section
 */
export async function getSection<T = Record<string, unknown>>(
  section: SettingsSection
): Promise<SectionResponse<T>> {
  const response = await client.get<SectionResponse<T>>(`/settings/${ section }`);

  return response.data;
}

/**
 * Update a settings section
 */
export async function updateSection(
  section: SettingsSection,
  data: Record<string, unknown>
): Promise<UpdateResponse> {
  const response = await client.put<UpdateResponse>(`/settings/${ section }`, data);

  return response.data;
}

/**
 * Validate settings without saving
 */
export async function validate(
  section: SettingsSection,
  data: Record<string, unknown>
): Promise<{ valid: boolean; errors?: Array<{ path: string; message: string }> }> {
  const response = await client.post<{
    valid:   boolean;
    errors?: Array<{ path: string; message: string }>;
  }>('/settings/validate', { section, data });

  return response.data;
}
