import type { WishlistItemSource, WishlistItemType } from '@server/models/WishlistItem';

import { z } from 'zod';

/**
 * Wishlist entry schema with all metadata fields
 */
export const wishlistEntrySchema = z.object({
  id:          z.uuid(),
  artist:      z.string(),
  title:       z.string(),
  type:        z.enum(['album', 'track', 'artist']),
  year:        z.number().int().positive().optional()
    .nullable(),
  mbid:        z.string().optional().nullable(),
  source:      z.enum(['listenbrainz', 'catalog', 'manual']).optional().nullable(),
  coverUrl:    z.url().optional().nullable(),
  addedAt:     z.iso.datetime().or(z.date()),
  processedAt: z.iso.datetime().or(z.date()).optional()
    .nullable(),
});

export type WishlistEntry = z.infer<typeof wishlistEntrySchema>;

/**
 * Add to wishlist request schema
 */
export const addToWishlistRequestSchema = z.object({
  artist: z.string().min(1, 'Artist is required'),
  title:  z.string(),
  type:   z.enum(['album', 'track', 'artist']),
  year:   z.number().int().positive().optional(),
  mbid:   z.string().optional(),
}).refine(
  (data) => data.type === 'artist' || data.title.length >= 1,
  { message: 'Title is required for album and track types', path: ['title'] }
);

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

/**
 * Delete from wishlist response schema
 */
export const deleteFromWishlistResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
});

export type DeleteFromWishlistResponse = z.infer<typeof deleteFromWishlistResponseSchema>;

/**
 * Options for creating a wishlist item
 */
export interface CreateWishlistItemOptions {
  artist:    string;
  album:     string;
  type:      WishlistItemType;
  year?:     number;
  mbid?:     string;
  source?:   WishlistItemSource;
  coverUrl?: string;
}

/**
 * Options for processing approved queue items
 */
export interface ProcessApprovedItem {
  artist:    string;
  album?:    string;
  title?:    string;
  type?:     string;
  year?:     number;
  mbid?:     string;
  source?:   string;
  coverUrl?: string;
}
