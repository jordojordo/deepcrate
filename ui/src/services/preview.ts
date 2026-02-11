import type { PreviewResponse, AlbumPreviewResponse } from '@/types';

import client from './api';

export interface GetPreviewParams {
  artist: string;
  track:  string;
}

export interface GetAlbumPreviewParams {
  artist:       string;
  album:        string;
  mbid?:        string;
  sourceTrack?: string;
}

export async function getPreview(params: GetPreviewParams): Promise<PreviewResponse> {
  const response = await client.get<PreviewResponse>('/preview', { params });

  return response.data;
}

export async function getAlbumPreview(params: GetAlbumPreviewParams): Promise<AlbumPreviewResponse> {
  const response = await client.get<AlbumPreviewResponse>('/preview/album', { params });

  return response.data;
}
