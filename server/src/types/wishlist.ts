import { z } from 'zod';

/**
 * Wishlist entry schema
 */
export const wishlistEntrySchema = z.object({
  artist: z.string(),
  title:  z.string(),
  type:   z.enum(['album', 'track']),
});

export type WishlistEntry = z.infer<typeof wishlistEntrySchema>;

/**
 * Add to wishlist request schema
 */
export const addToWishlistRequestSchema = z.object({
  artist: z.string().min(1, 'Artist is required'),
  title:  z.string().min(1, 'Title is required'),
  type:   z.enum(['album', 'track']),
});

export type AddToWishlistRequest = z.infer<typeof addToWishlistRequestSchema>;

/**
 * Wishlist response schema
 */
export const wishlistResponseSchema = z.object({
  entries: z.array(wishlistEntrySchema),
  total:   z.number().int().nonnegative(),
});

export type WishlistResponse = z.infer<typeof wishlistResponseSchema>;

/**
 * Add to wishlist response schema
 */
export const addToWishlistResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  entry:   wishlistEntrySchema,
});

export type AddToWishlistResponse = z.infer<typeof addToWishlistResponseSchema>;
