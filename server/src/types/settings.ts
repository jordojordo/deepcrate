import { z } from 'zod';

/**
 * Secret field indicator (replaces actual values in API responses)
 */
export const SecretStatusSchema = z.object({ configured: z.boolean() });

export type SecretStatus = z.infer<typeof SecretStatusSchema>;

/**
 * Valid config section names
 */
export const SETTINGS_SECTIONS = [
  'listenbrainz',
  'slskd',
  'catalog_discovery',
  'library_duplicate',
  'library_organize',
  'preview',
  'ui',
] as const;

export type SettingsSection = typeof SETTINGS_SECTIONS[number];

export const SettingsSectionSchema = z.enum(SETTINGS_SECTIONS);

/**
 * API response schemas (secrets replaced with configured status)
 */

export const SanitizedListenBrainzSchema = z.object({
  username:      z.string(),
  token:         SecretStatusSchema,
  approval_mode: z.enum(['auto', 'manual']),
  source_type:   z.enum(['collaborative', 'weekly_playlist']),
});

export const SanitizedSlskdSchema = z.object({
  host:             z.string(),
  api_key:          SecretStatusSchema,
  url_base:         z.string(),
  search_timeout:   z.number(),
  min_album_tracks: z.number(),
  search:           z.record(z.string(), z.unknown()).optional(),
  selection:        z.record(z.string(), z.unknown()).optional(),
});

export const SanitizedSubsonicSchema = z.object({
  host:     z.string(),
  username: z.string(),
  password: SecretStatusSchema,
});

/** @deprecated Use SanitizedSubsonicSchema instead */
export const SanitizedNavidromeSchema = SanitizedSubsonicSchema;

export const SanitizedLastFmSchema = z.object({ api_key: SecretStatusSchema });

export const SanitizedCatalogDiscoverySchema = z.object({
  enabled:              z.boolean(),
  subsonic:             SanitizedSubsonicSchema.optional(),
  lastfm:               SanitizedLastFmSchema.optional(),
  max_artists_per_run:  z.number(),
  min_similarity:       z.number(),
  similar_artist_limit: z.number().optional(),
  albums_per_artist:    z.number().optional(),
  mode:                 z.enum(['auto', 'manual']),
});

export const SanitizedSpotifySchema = z.object({
  enabled:       z.boolean(),
  client_id:     SecretStatusSchema.optional(),
  client_secret: SecretStatusSchema.optional(),
});

export const SanitizedPreviewSchema = z.object({
  enabled: z.boolean(),
  spotify: SanitizedSpotifySchema.optional(),
});

export const SanitizedAuthSchema = z.object({
  enabled:  z.boolean(),
  type:     z.enum(['basic', 'api_key', 'proxy']),
  username: z.string().optional(),
  password: SecretStatusSchema.optional(),
  api_key:  SecretStatusSchema.optional(),
});

export const SanitizedUISchema = z.object({ auth: SanitizedAuthSchema });

/**
 * API response types
 */

export const GetSettingsResponseSchema = z.object({
  debug:             z.boolean(),
  mode:              z.enum(['album', 'track']),
  fetch_count:       z.number(),
  min_score:         z.number(),
  listenbrainz:      SanitizedListenBrainzSchema.optional(),
  slskd:             SanitizedSlskdSchema.optional(),
  catalog_discovery: SanitizedCatalogDiscoverySchema,
  library_duplicate: z.record(z.string(), z.unknown()).optional(),
  library_organize:  z.record(z.string(), z.unknown()).optional(),
  preview:           SanitizedPreviewSchema.optional(),
  ui:                SanitizedUISchema,
});

export type GetSettingsResponse = z.infer<typeof GetSettingsResponseSchema>;

export const GetSectionResponseSchema = z.object({
  section: z.string(),
  data:    z.record(z.string(), z.unknown()),
});

export type GetSectionResponse = z.infer<typeof GetSectionResponseSchema>;

export const UpdateSectionResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  section: z.string(),
});

export type UpdateSectionResponse = z.infer<typeof UpdateSectionResponseSchema>;

export const ValidateResponseSchema = z.object({
  valid:  z.boolean(),
  errors: z.array(z.object({
    path:    z.string(),
    message: z.string(),
  })).optional(),
});

export type ValidateResponse = z.infer<typeof ValidateResponseSchema>;

/**
 * API request schemas (for updating sections)
 */

export const UpdateListenBrainzRequestSchema = z.object({
  username:      z.string().optional(),
  token:         z.string().optional(),
  approval_mode: z.enum(['auto', 'manual']).optional(),
  source_type:   z.enum(['collaborative', 'weekly_playlist']).optional(),
});

export type UpdateListenBrainzRequest = z.infer<typeof UpdateListenBrainzRequestSchema>;

export const UpdateSlskdRequestSchema = z.object({
  host:             z.string().optional(),
  api_key:          z.string().optional(),
  url_base:         z.string().optional(),
  search_timeout:   z.number().optional(),
  min_album_tracks: z.number().optional(),
  search:           z.record(z.string(), z.unknown()).optional(),
  selection:        z.record(z.string(), z.unknown()).optional(),
});

export type UpdateSlskdRequest = z.infer<typeof UpdateSlskdRequestSchema>;

export const UpdateCatalogDiscoveryRequestSchema = z.object({
  enabled:              z.boolean().optional(),
  subsonic:             z.object({
    host:     z.string().optional(),
    username: z.string().optional(),
    password: z.string().optional(),
  }).optional(),
  lastfm:               z.object({ api_key: z.string().optional() }).optional(),
  max_artists_per_run:  z.number().optional(),
  min_similarity:       z.number().optional(),
  similar_artist_limit: z.number().optional(),
  albums_per_artist:    z.number().optional(),
  mode:                 z.enum(['auto', 'manual']).optional(),
});

export type UpdateCatalogDiscoveryRequest = z.infer<typeof UpdateCatalogDiscoveryRequestSchema>;

export const UpdatePreviewRequestSchema = z.object({
  enabled: z.boolean().optional(),
  spotify: z.object({
    enabled:       z.boolean().optional(),
    client_id:     z.string().optional(),
    client_secret: z.string().optional(),
  }).optional(),
});

export type UpdatePreviewRequest = z.infer<typeof UpdatePreviewRequestSchema>;

export const UpdateUIRequestSchema = z.object({
  auth: z.object({
    enabled:  z.boolean().optional(),
    type:     z.enum(['basic', 'api_key', 'proxy']).optional(),
    username: z.string().optional(),
    password: z.string().optional(),
    api_key:  z.string().optional(),
  }).optional(),
});

export type UpdateUIRequest = z.infer<typeof UpdateUIRequestSchema>;

export const ValidateConfigRequestSchema = z.object({
  section: SettingsSectionSchema,
  data:    z.record(z.string(), z.unknown()),
});

export type ValidateConfigRequest = z.infer<typeof ValidateConfigRequestSchema>;

/**
 * Map of update request schemas for partial validation
 */
export const UPDATE_SCHEMAS: Record<SettingsSection, z.ZodType<unknown>> = {
  listenbrainz:      UpdateListenBrainzRequestSchema,
  slskd:             UpdateSlskdRequestSchema,
  catalog_discovery: UpdateCatalogDiscoveryRequestSchema,
  library_duplicate: z.object({}).passthrough(),
  library_organize:  z.object({}).passthrough(),
  preview:           UpdatePreviewRequestSchema,
  ui:                UpdateUIRequestSchema,
};
