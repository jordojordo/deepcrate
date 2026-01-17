import { z } from 'zod';

/**
 * Download status enum
 */
export const downloadStatusSchema = z.enum([
  'pending',
  'searching',
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
  id:              z.string().uuid(),
  wishlistKey:     z.string(),
  artist:          z.string(),
  album:           z.string(),
  type:            z.enum(['album', 'track']),
  status:          downloadStatusSchema,
  slskdUsername:   z.string().nullable(),
  slskdDirectory:  z.string().nullable(),
  fileCount:       z.number().int().positive().nullable(),
  progress:        downloadProgressSchema.nullable(),
  queuedAt:        z.coerce.date(),
  startedAt:       z.coerce.date().nullable(),
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
  type:            z.enum(['album', 'track']),
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
  type:            z.enum(['album', 'track']),
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
