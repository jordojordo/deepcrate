import { z } from 'zod';

/**
 * Quality tier enum
 */
export const qualityTierSchema = z.enum(['lossless', 'high', 'standard', 'low', 'unknown']);

export type QualityTier = z.infer<typeof qualityTierSchema>;

/**
 * Quality info schema
 */
export const qualityInfoSchema = z.object({
  format:     z.string(),
  bitRate:    z.number().nullable(),
  bitDepth:   z.number().nullable(),
  sampleRate: z.number().nullable(),
  tier:       qualityTierSchema,
});

export type QualityInfo = z.infer<typeof qualityInfoSchema>;

/**
 * Download status enum
 */
export const downloadStatusSchema = z.enum([
  'pending',
  'searching',
  'pending_selection',
  'deferred',
  'queued',
  'downloading',
  'completed',
  'failed',
]);

export type DownloadStatus = z.infer<typeof downloadStatusSchema>;

/**
 * Download progress schema (real-time data from slskd)
 */
export const downloadProgressSchema = z.object({
  filesCompleted:          z.number().int().nonnegative(),
  filesTotal:              z.number().int().nonnegative(),
  bytesTransferred:        z.number().nonnegative(),
  bytesTotal:              z.number().nonnegative(),
  averageSpeed:            z.number().nonnegative().nullable(),
  estimatedTimeRemaining:  z.number().nonnegative().nullable(),
});

export type DownloadProgress = z.infer<typeof downloadProgressSchema>;

/**
 * Active download schema (database record + real-time progress)
 */
export const activeDownloadSchema = z.object({
  id:                  z.string().uuid(),
  wishlistKey:         z.string(),
  artist:              z.string(),
  album:               z.string(),
  type:                z.enum(['artist', 'album', 'track']),
  status:              downloadStatusSchema,
  slskdUsername:       z.string().nullable(),
  slskdDirectory:      z.string().nullable(),
  fileCount:           z.number().int().positive().nullable(),
  quality:             qualityInfoSchema.nullable(),
  progress:            downloadProgressSchema.nullable(),
  searchQuery:         z.string().nullable().optional(),
  selectionExpiresAt:  z.coerce.date().nullable().optional(),
  queuedAt:            z.coerce.date(),
  startedAt:           z.coerce.date().nullable(),
});

export type ActiveDownload = z.infer<typeof activeDownloadSchema>;

/**
 * Completed download schema (database record)
 */
export const completedDownloadSchema = z.object({
  id:              z.string().uuid(),
  wishlistKey:     z.string(),
  artist:          z.string(),
  album:           z.string(),
  type:            z.enum(['artist', 'album', 'track']),
  slskdUsername:   z.string().nullable(),
  fileCount:       z.number().int().positive().nullable(),
  queuedAt:        z.coerce.date(),
  completedAt:     z.coerce.date(),
});

export type CompletedDownload = z.infer<typeof completedDownloadSchema>;

/**
 * Failed download schema (database record)
 */
export const failedDownloadSchema = z.object({
  id:              z.string().uuid(),
  wishlistKey:     z.string(),
  artist:          z.string(),
  album:           z.string(),
  type:            z.enum(['artist', 'album', 'track']),
  errorMessage:    z.string().nullable(),
  retryCount:      z.number().int().nonnegative(),
  queuedAt:        z.coerce.date(),
  completedAt:     z.coerce.date(),
});

export type FailedDownload = z.infer<typeof failedDownloadSchema>;

/**
 * Query params for getting downloads
 */
export const getDownloadsQuerySchema = z.object({
  limit:  z.coerce.number().int().positive().default(50),
  offset: z.coerce.number().int().nonnegative().default(0),
});

export type GetDownloadsQuery = z.infer<typeof getDownloadsQuerySchema>;

/**
 * Retry request schema
 */
export const retryRequestSchema = z.object({ ids: z.array(z.string().uuid()).min(1) });

export type RetryRequest = z.infer<typeof retryRequestSchema>;

/**
 * Delete request schema
 */
export const deleteRequestSchema = z.object({ ids: z.array(z.string().uuid()).min(1) });

export type DeleteRequest = z.infer<typeof deleteRequestSchema>;

/**
 * Download stats schema
 */
export const downloadStatsSchema = z.object({
  active:         z.number().int().nonnegative(),
  queued:         z.number().int().nonnegative(),
  completed:      z.number().int().nonnegative(),
  failed:         z.number().int().nonnegative(),
  totalBandwidth: z.number().nonnegative().nullable(),
});

export type DownloadStats = z.infer<typeof downloadStatsSchema>;

/**
 * Directory group for search results UI
 */
export const directoryGroupSchema = z.object({
  path:        z.string(),
  files:       z.array(z.object({
    filename:   z.string(),
    size:       z.number().optional(),
    bitRate:    z.number().optional(),
    bitDepth:   z.number().optional(),
    sampleRate: z.number().optional(),
    length:     z.number().optional(),
  })),
  totalSize:   z.number(),
  qualityInfo: qualityInfoSchema.nullable(),
});

export type DirectoryGroup = z.infer<typeof directoryGroupSchema>;

/**
 * Scored search response for UI display
 */
export const scoredSearchResponseSchema = z.object({
  response: z.object({
    username:          z.string(),
    files:             z.array(z.object({
      filename:   z.string(),
      size:       z.number().optional(),
      bitRate:    z.number().optional(),
      bitDepth:   z.number().optional(),
      sampleRate: z.number().optional(),
      length:     z.number().optional(),
    })),
    hasFreeUploadSlot: z.boolean().optional(),
    uploadSpeed:       z.number().optional(),
  }),
  score:          z.number(),
  musicFileCount: z.number(),
  totalSize:      z.number(),
  qualityInfo:    qualityInfoSchema.nullable(),
  directories:    z.array(directoryGroupSchema),
});

export type ScoredSearchResponse = z.infer<typeof scoredSearchResponseSchema>;

/**
 * Search results response for selection endpoint
 */
export const searchResultsResponseSchema = z.object({
  task: z.object({
    id:                 z.string().uuid(),
    artist:             z.string(),
    album:              z.string(),
    searchQuery:        z.string(),
    selectionExpiresAt: z.coerce.date().nullable(),
  }),
  results:          z.array(scoredSearchResponseSchema),
  skippedUsernames: z.array(z.string()),
});

export type SearchResultsResponse = z.infer<typeof searchResultsResponseSchema>;

/**
 * Select result request schema
 */
export const selectResultRequestSchema = z.object({
  username:  z.string(),
  directory: z.string().optional(),
});

export type SelectResultRequest = z.infer<typeof selectResultRequestSchema>;

/**
 * Skip result request schema
 */
export const skipResultRequestSchema = z.object({ username: z.string() });

export type SkipResultRequest = z.infer<typeof skipResultRequestSchema>;

/**
 * Retry search request schema
 */
export const retrySearchRequestSchema = z.object({ query: z.string().optional() });

export type RetrySearchRequest = z.infer<typeof retrySearchRequestSchema>;

/**
 * Cached slskd search response schema for validating JSON parsed data
 */
export const slskdSearchResponseSchema = z.object({
  username:          z.string(),
  files:             z.array(z.object({
    filename:   z.string(),
    size:       z.number().optional(),
    bitRate:    z.number().optional(),
    bitDepth:   z.number().optional(),
    sampleRate: z.number().optional(),
    length:     z.number().optional(),
  })),
  hasFreeUploadSlot: z.boolean().optional(),
  uploadSpeed:       z.number().optional(),
});

export const cachedSearchResultsSchema = z.array(slskdSearchResponseSchema);

export type CachedSearchResults = z.infer<typeof cachedSearchResultsSchema>;
