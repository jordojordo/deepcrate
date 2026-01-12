import type { WishlistEntry, AddWishlistRequest } from '@/types/wishlist';

import client from './api';

export interface WishlistResponse {
  items: WishlistEntry[];
}

export interface AddWishlistResponse {
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
