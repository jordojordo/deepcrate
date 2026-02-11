import type {
  AddWishlistResponse,
  AddWishlistRequest,
  DeleteWishlistResponse,
  UpdateWishlistResponse,
  UpdateWishlistRequest,
  WishlistResponse,
  WishlistFilters,
  PaginatedWishlistResponse,
  BulkOperationResponse,
  ImportItem,
  ImportResponse,
  ExportFormat,
} from '@/types';

import client from './api';

export async function getWishlist(): Promise<WishlistResponse> {
  const response = await client.get<WishlistResponse>('/wishlist');

  return response.data;
}

export async function addToWishlist(request: AddWishlistRequest): Promise<AddWishlistResponse> {
  const response = await client.post<AddWishlistResponse>('/wishlist', request);

  return response.data;
}

export async function deleteFromWishlist(id: string): Promise<DeleteWishlistResponse> {
  const response = await client.delete<DeleteWishlistResponse>(`/wishlist/${ id }`);

  return response.data;
}

export async function getWishlistPaginated(filters: WishlistFilters): Promise<PaginatedWishlistResponse> {
  const params: Record<string, string | number> = {};

  if (filters.source) {
    params.source = filters.source;
  }
  if (filters.type) {
    params.type = filters.type;
  }
  if (filters.processed) {
    params.processed = filters.processed;
  }
  if (filters.dateFrom) {
    params.dateFrom = filters.dateFrom;
  }
  if (filters.dateTo) {
    params.dateTo = filters.dateTo;
  }
  if (filters.search) {
    params.search = filters.search;
  }
  if (filters.sort) {
    params.sort = filters.sort;
  }
  if (filters.limit !== undefined) {
    params.limit = filters.limit;
  }
  if (filters.offset !== undefined) {
    params.offset = filters.offset;
  }

  const response = await client.get<PaginatedWishlistResponse>('/wishlist/paginated', { params });

  return response.data;
}

export async function updateWishlistItem(
  id: string,
  data: UpdateWishlistRequest
): Promise<UpdateWishlistResponse> {
  const response = await client.put<UpdateWishlistResponse>(`/wishlist/${ id }`, data);

  return response.data;
}

export async function bulkDeleteWishlist(ids: string[]): Promise<BulkOperationResponse> {
  const response = await client.delete<BulkOperationResponse>('/wishlist/bulk', { data: { ids } });

  return response.data;
}

export async function bulkRequeueWishlist(ids: string[]): Promise<BulkOperationResponse> {
  const response = await client.post<BulkOperationResponse>('/wishlist/requeue', { ids });

  return response.data;
}

export async function exportWishlist(format: ExportFormat, ids?: string[]): Promise<Blob> {
  const params: Record<string, string> = { format };

  if (ids?.length) {
    params.ids = ids.join(',');
  }

  const response = await client.get('/wishlist/export', {
    params,
    responseType: 'blob',
  });

  return response.data as Blob;
}

export function downloadExportFile(blob: Blob, format: ExportFormat): void {
  const url = URL.createObjectURL(blob);

  try {
    const a = document.createElement('a');

    a.href = url;
    a.download = `wishlist.${ format }`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function importWishlist(items: ImportItem[]): Promise<ImportResponse> {
  const response = await client.post<ImportResponse>('/wishlist/import', { items });

  return response.data;
}
