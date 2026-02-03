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
 * Update wishlist item request schema
 * Partial updates - all fields optional
 */
export const updateWishlistItemSchema = z.object({
  artist:             z.string().min(1).optional(),
  title:              z.string().optional(),
  type:               z.enum(['album', 'track', 'artist']).optional(),
  year:               z.number().int().positive().optional()
    .nullable(),
  mbid:               z.string().optional().nullable(),
  source:             z.enum(['listenbrainz', 'catalog', 'manual']).optional().nullable(),
  coverUrl:           z.url().optional().nullable(),
  resetDownloadState: z.boolean().optional(), // If true, clears processedAt to re-queue for download
});

export type UpdateWishlistItemRequest = z.infer<typeof updateWishlistItemSchema>;

/**
 * Update wishlist item response schema
 */
export const updateWishlistItemResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  entry:   wishlistEntrySchema,
});

export type UpdateWishlistItemResponse = z.infer<typeof updateWishlistItemResponseSchema>;

/**
 * Bulk delete request schema
 */
export const bulkDeleteSchema = z.object({ ids: z.array(z.uuid()).min(1, 'At least one ID is required') });

export type BulkDeleteRequest = z.infer<typeof bulkDeleteSchema>;

/**
 * Bulk requeue request schema
 */
export const bulkRequeueSchema = z.object({ ids: z.array(z.uuid()).min(1, 'At least one ID is required') });

export type BulkRequeueRequest = z.infer<typeof bulkRequeueSchema>;

/**
 * Bulk operation response schema
 */
export const bulkOperationResponseSchema = z.object({
  success:  z.boolean(),
  message:  z.string(),
  affected: z.number().int().nonnegative(),
});

export type BulkOperationResponse = z.infer<typeof bulkOperationResponseSchema>;

/**
 * Sort order for wishlist items
 */
export const wishlistSortSchema = z.enum([
  'addedAt_asc', 'addedAt_desc',
  'artist_asc', 'artist_desc',
  'title_asc', 'title_desc',
  'processedAt_asc', 'processedAt_desc',
]);

export type WishlistSort = z.infer<typeof wishlistSortSchema>;

/**
 * Wishlist filters schema for paginated queries
 */
export const wishlistFiltersSchema = z.object({
  source:      z.enum(['listenbrainz', 'catalog', 'manual']).optional(),
  type:        z.enum(['album', 'track', 'artist']).optional(),
  processed:   z.enum(['all', 'pending', 'processed']).optional(), // pending = processedAt is null
  dateFrom:    z.iso.datetime().optional(),
  dateTo:      z.iso.datetime().optional(),
  search:      z.string().optional(), // Search artist or title
  sort:        wishlistSortSchema.optional(),
  limit:       z.coerce.number().int().positive().max(100)
    .optional(),
  offset: z.coerce.number().int().nonnegative().optional(),
});

export type WishlistFilters = z.infer<typeof wishlistFiltersSchema>;

/**
 * Download status types from DownloadTask
 */
export const downloadStatusSchema = z.enum([
  'none',               // No download task yet (processedAt is null)
  'pending',            // DownloadTask created, waiting to be processed
  'searching',          // Searching slskd
  'pending_selection',  // Waiting for user selection
  'deferred',           // Deferred for later
  'queued',             // Queued in slskd
  'downloading',        // Actively downloading
  'completed',          // Download completed
  'failed',             // Download failed
]);

export type DownloadStatus = z.infer<typeof downloadStatusSchema>;

/**
 * Wishlist entry with download status information
 */
export const wishlistEntryWithStatusSchema = wishlistEntrySchema.extend({
  downloadStatus:  downloadStatusSchema,
  downloadTaskId:  z.uuid().optional().nullable(),
  downloadError:   z.string().optional().nullable(),
});

export type WishlistEntryWithStatus = z.infer<typeof wishlistEntryWithStatusSchema>;

/**
 * Paginated wishlist response with status
 */
export const paginatedWishlistResponseSchema = z.object({
  entries: z.array(wishlistEntryWithStatusSchema),
  total:   z.number().int().nonnegative(),
  limit:   z.number().int().positive(),
  offset:  z.number().int().nonnegative(),
});

export type PaginatedWishlistResponse = z.infer<typeof paginatedWishlistResponseSchema>;

/**
 * Export format options
 */
export const exportFormatSchema = z.enum(['json']);

export type ExportFormat = z.infer<typeof exportFormatSchema>;

/**
 * Export request schema
 */
export const exportRequestSchema = z.object({
  format: exportFormatSchema,
  ids:    z.array(z.uuid()).optional(), // If empty/undefined, export all
});

export type ExportRequest = z.infer<typeof exportRequestSchema>;

/**
 * Single item for import
 */
export const importItemSchema = z.object({
  artist:   z.string().min(1, 'Artist is required'),
  title:    z.string(),
  type:     z.enum(['album', 'track', 'artist']),
  year:     z.number().int().positive().optional()
    .nullable(),
  mbid:     z.string().optional().nullable(),
  source:   z.enum(['listenbrainz', 'catalog', 'manual']).optional().nullable(),
  coverUrl: z.url().optional().nullable(),
}).refine(
  (data) => data.type === 'artist' || (data.title && data.title.length >= 1),
  { message: 'Title is required for album and track types', path: ['title'] }
);

export type ImportItem = z.infer<typeof importItemSchema>;

/**
 * Import request schema
 */
export const importRequestSchema = z.object({ items: z.array(importItemSchema).min(1, 'At least one item is required') });

export type ImportRequest = z.infer<typeof importRequestSchema>;

/**
 * Single import result
 */
export const importResultItemSchema = z.object({
  artist:  z.string(),
  title:   z.string(),
  status:  z.enum(['added', 'skipped', 'error']),
  message: z.string().optional(),
});

export type ImportResultItem = z.infer<typeof importResultItemSchema>;

/**
 * Import response schema
 */
export const importResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  added:   z.number().int().nonnegative(),
  skipped: z.number().int().nonnegative(),
  errors:  z.number().int().nonnegative(),
  results: z.array(importResultItemSchema),
});

export type ImportResponse = z.infer<typeof importResponseSchema>;

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
