import type { WishlistEntry, AddWishlistRequest } from '@/types/wishlist';

import client from './api';

export interface WishlistResponse {
  entries: WishlistEntry[];
  total:   number;
}

export interface AddWishlistResponse {
  success: boolean;
  message: string;
  entry:   WishlistEntry;
}

export interface DeleteWishlistResponse {
  success: boolean;
  message: string;
}

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
