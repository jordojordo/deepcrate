import type {
  AlbumPreviewResponse,
  GetPreviewParams,
  GetAlbumPreviewParams,
  PreviewResponse,
} from '@/types';

import client from './api';

export async function getPreview(params: GetPreviewParams): Promise<PreviewResponse> {
  const response = await client.get<PreviewResponse>('/preview', { params });

  return response.data;
}

export async function getAlbumPreview(params: GetAlbumPreviewParams): Promise<AlbumPreviewResponse> {
  const response = await client.get<AlbumPreviewResponse>('/preview/album', { params });

  return response.data;
}
