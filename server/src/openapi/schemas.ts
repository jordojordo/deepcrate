import { z } from 'zod';

import { registry } from '@server/openapi/registry';
import {
  actionResponseSchema,
  errorResponseSchema,
  healthResponseSchema,
  authInfoResponseSchema,
  authMeResponseSchema,
  paginatedResponseSchema,
} from '@server/types/responses';
import { queueItemSchema } from '@server/types/queue';
import {
  wishlistEntrySchema,
  wishlistEntryWithStatusSchema,
  wishlistResponseSchema,
  paginatedWishlistResponseSchema,
  addToWishlistResponseSchema,
  deleteFromWishlistResponseSchema,
  updateWishlistItemResponseSchema,
  bulkOperationResponseSchema,
  importResponseSchema,
} from '@server/types/wishlist';
import {
  qualityInfoSchema,
  activeDownloadSchema,
  completedDownloadSchema,
  failedDownloadSchema,
  downloadStatsSchema,
  searchResultsResponseSchema,
  selectResultRequestSchema,
} from '@server/types/downloads';
import {
  jobStatusSchema,
  jobStatusResponseSchema,
  triggerJobResponseSchema,
  cancelJobResponseSchema,
} from '@server/types/jobs';
import {
  albumSearchResultSchema,
  artistSearchResultSchema,
  recordingSearchResultSchema,
  musicBrainzSearchResponseSchema,
} from '@server/types/search';
import {
  GetSettingsResponseSchema,
  GetSectionResponseSchema,
  UpdateSectionResponseSchema,
  ValidateResponseSchema,
} from '@server/types/settings';

// --- Response schemas ---

registry.register('ActionResponse', actionResponseSchema);
registry.register('ErrorResponse', errorResponseSchema);
registry.register('HealthResponse', healthResponseSchema);
registry.register('AuthInfoResponse', authInfoResponseSchema);
registry.register('AuthMeResponse', authMeResponseSchema);

// --- Queue schemas ---

const queueItemResponseSchema = queueItemSchema.extend({ in_library: z.boolean().optional() });

registry.register('QueueItem', queueItemResponseSchema);
registry.register('PaginatedQueueResponse', paginatedResponseSchema(queueItemResponseSchema));

// --- Wishlist schemas ---

registry.register('WishlistEntry', wishlistEntrySchema);
registry.register('WishlistEntryWithStatus', wishlistEntryWithStatusSchema);
registry.register('AddToWishlistRequest', z.object({
  artist: z.string(),
  title:  z.string(),
  type:   z.enum(['album', 'track', 'artist']),
  year:   z.number().int().positive().optional(),
  mbid:   z.string().optional(),
}));
registry.register('WishlistResponse', wishlistResponseSchema);
registry.register('PaginatedWishlistResponse', paginatedWishlistResponseSchema);
registry.register('AddToWishlistResponse', addToWishlistResponseSchema);
registry.register('DeleteFromWishlistResponse', deleteFromWishlistResponseSchema);
registry.register('UpdateWishlistItem', z.object({
  artist:             z.string().min(1).optional(),
  title:              z.string().optional(),
  type:               z.enum(['album', 'track', 'artist']).optional(),
  year:               z.number().int().positive().optional()
    .nullable(),
  mbid:               z.string().optional().nullable(),
  source:             z.enum(['listenbrainz', 'catalog', 'manual']).optional().nullable(),
  coverUrl:           z.url().optional().nullable(),
  resetDownloadState: z.boolean().optional(),
}));
registry.register('UpdateWishlistItemResponse', updateWishlistItemResponseSchema);
registry.register('BulkOperationResponse', bulkOperationResponseSchema);
registry.register('ImportResponse', importResponseSchema);

// --- Download schemas ---

registry.register('QualityInfo', qualityInfoSchema);
registry.register('ActiveDownload', activeDownloadSchema);
registry.register('CompletedDownload', completedDownloadSchema);
registry.register('FailedDownload', failedDownloadSchema);
registry.register('DownloadStats', downloadStatsSchema);
registry.register('SearchResultsResponse', searchResultsResponseSchema);
registry.register('SelectResultRequest', selectResultRequestSchema);

// --- Job schemas ---

registry.register('JobStatus', jobStatusSchema);
registry.register('JobStatusResponse', jobStatusResponseSchema);
registry.register('TriggerJobResponse', triggerJobResponseSchema);
registry.register('CancelJobResponse', cancelJobResponseSchema);

// --- Search schemas ---

registry.register('AlbumSearchResult', albumSearchResultSchema);
registry.register('ArtistSearchResult', artistSearchResultSchema);
registry.register('RecordingSearchResult', recordingSearchResultSchema);
registry.register('MusicBrainzSearchResponse', musicBrainzSearchResponseSchema);

// --- Activity schema ---

const activityItemSchema = z.object({
  id:          z.string(),
  title:       z.string(),
  description: z.string(),
  timestamp:   z.string(),
  type:        z.enum(['added', 'approved', 'rejected', 'downloaded', 'queued']),
  coverUrl:    z.string().optional(),
});

registry.register('ActivityItem', activityItemSchema);

// --- Settings schemas ---

registry.register('GetSettingsResponse', GetSettingsResponseSchema);
registry.register('GetSectionResponse', GetSectionResponseSchema);
registry.register('UpdateSectionResponse', UpdateSectionResponseSchema);
registry.register('ValidateResponse', ValidateResponseSchema);

// --- Webhook schemas ---

const webhookEventSchema = z.enum([
  'download_completed',
  'queue_approved',
  'queue_rejected',
]);

const webhookPayloadSchema = z.object({
  event:     webhookEventSchema,
  timestamp: z.string(),
  data:      z.object({
    artist:        z.string().optional(),
    album:         z.string().optional(),
    download_path: z.string().optional(),
    mbid:          z.string().optional(),
  }),
});

const webhookExecutionResultSchema = z.object({
  success:    z.boolean(),
  statusCode: z.number().optional(),
  duration:   z.number(),
  error:      z.string().optional(),
});

const testWebhookRequestSchema = z.object({
  url:        z.url(),
  secret:     z.string().optional(),
  timeout_ms: z.number().int().positive().max(30000)
    .default(10000),
  dry_run: z.boolean().default(false),
});

const testWebhookDryRunResponseSchema = z.object({
  success: z.literal(true),
  dry_run: z.literal(true),
  payload: webhookPayloadSchema,
});

registry.register('WebhookPayload', webhookPayloadSchema);
registry.register('WebhookExecutionResult', webhookExecutionResultSchema);
registry.register('TestWebhookRequest', testWebhookRequestSchema);
registry.register('TestWebhookDryRunResponse', testWebhookDryRunResponseSchema);

export {
  activityItemSchema,
  queueItemResponseSchema,
  testWebhookRequestSchema,
  webhookExecutionResultSchema,
  testWebhookDryRunResponseSchema,
};
