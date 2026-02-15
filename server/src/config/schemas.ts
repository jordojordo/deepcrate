import { z } from 'zod';

import { DEFAULT_PREFERRED_FORMATS } from '@server/constants/slskd';
import logger from '@server/config/logger';

/**
 * Superrefine helper: when `enabled` is true, require specified fields.
 */
function requireFieldsWhenEnabled<T extends Record<string, unknown>>(
  fields: Array<{ field: keyof T & string; message: string }>,
) {
  return (value: T, ctx: z.RefinementCtx) => {
    if (!(value as { enabled?: boolean }).enabled) {
      return;
    }

    for (const { field, message } of fields) {
      if (!value[field]) {
        ctx.addIssue({
          code: 'custom', message, path: [field],
        });
      }
    }
  };
}

/**
 * Zod schemas for configuration validation
 */

const AuthTypeSchema = z.preprocess((value) => {
  // Back-compat: older docs used "none" for reverse-proxy auth.
  if (typeof value === 'string' && value.toLowerCase() === 'none') {
    return 'proxy';
  }

  return value;
}, z.enum(['basic', 'api_key', 'proxy']));

const AuthSettingsSchema = z.object({
  enabled:  z.boolean(),
  type:     AuthTypeSchema.default('basic'),
  username: z.string().optional(),
  password: z.string().optional(),
  api_key:  z.string().optional(),
}).superRefine((value, ctx) => {
  if (!value.enabled) {
    return;
  }

  if (value.type === 'basic') {
    if (!value.username) {
      ctx.addIssue({
        code: 'custom', message: 'Required when ui.auth.type is basic', path: ['username']
      });
    }

    if (!value.password) {
      ctx.addIssue({
        code: 'custom', message: 'Required when ui.auth.type is basic', path: ['password']
      });
    }
  }

  if (value.type === 'api_key' && !value.api_key) {
    ctx.addIssue({
      code: 'custom', message: 'Required when ui.auth.type is api_key', path: ['api_key']
    });
  }
});

const UISettingsSchema = z.object({ auth: AuthSettingsSchema });

const ListenBrainzSettingsSchema = z.object({
  username:      z.string(),
  token:         z.string().optional(),
  approval_mode: z.enum(['auto', 'manual']).default('manual'),
  source_type:   z.enum(['collaborative', 'weekly_playlist']).default('weekly_playlist'),
});

const SlskdSearchRetrySchema = z.object({
  enabled:                  z.boolean().default(false),
  max_attempts:             z.number().int().min(1).max(10)
    .default(3),
  simplify_on_retry:        z.boolean().default(true),
  delay_between_retries_ms: z.number().int().min(0).default(5000),
});

const SlskdQualityPreferencesSchema = z.object({
  enabled:            z.boolean().default(true),
  preferred_formats:  z.array(z.string()).default([...DEFAULT_PREFERRED_FORMATS]),
  min_bitrate:        z.number().int().min(0).max(9999)
    .default(256),
  prefer_lossless:    z.boolean().default(true),
  reject_low_quality: z.boolean().default(false),
  reject_lossless:    z.boolean().default(false),
});

const SlskdCompletenessSchema = z.object({
  enabled:              z.boolean().default(true),
  require_complete:     z.boolean().default(false),
  completeness_weight:  z.number().int().min(0).max(1000)
    .default(500),
  min_completeness_ratio: z.number().min(0).max(1)
    .default(0.5),
  file_count_cap:       z.number().int().min(0).max(1000)
    .default(200),
  penalize_excess:      z.boolean().default(true),
  excess_decay_rate:    z.number().min(0).max(10)
    .default(2.0),
}).superRefine((value, ctx) => {
  if (value.require_complete && !value.enabled) {
    ctx.addIssue({
      code:    'custom',
      message: 'completeness.enabled must be true when require_complete is true',
      path:    ['require_complete'],
    });
  }
});

const SlskdSearchSchema = z.object({
  // Query templates - variables: {artist}, {album}, {title}, {year}
  artist_query_template:     z.string().default('{artist}'),
  album_query_template:      z.string().default('{artist} - {album}'),
  track_query_template:      z.string().default('{artist} - {title}'),
  fallback_queries:          z.array(z.string()).default([]),
  exclude_terms:             z.array(z.string()).default([]),

  // Search timing
  search_timeout_ms:         z.number().int().positive().default(15000),
  max_wait_ms:               z.number().int().positive().default(20000),

  // Response filtering
  min_response_files:        z.number().int().min(1).default(3),
  max_responses_to_evaluate: z.number().int().min(1).default(50),

  // File size constraints (MB)
  min_file_size_mb:          z.number().min(0).default(1),
  max_file_size_mb:          z.number().min(0).default(500),

  // Album preferences (soft, not strict)
  prefer_complete_albums:    z.boolean().default(true),
  prefer_album_folder:       z.boolean().default(true),

  retry: SlskdSearchRetrySchema.default({
    enabled:                  false,
    max_attempts:             3,
    simplify_on_retry:        true,
    delay_between_retries_ms: 5000,
  }),

  quality_preferences: SlskdQualityPreferencesSchema.optional(),
  completeness:        SlskdCompletenessSchema.optional(),
});

const SlskdSelectionSchema = z.object({
  mode:          z.enum(['auto', 'manual']).default('auto'),
  timeout_hours: z.number().int().min(0).default(24),  // 0 = no timeout
});

const SlskdSettingsSchema = z.object({
  host:             z.string(),
  api_key:          z.string(),
  url_base:         z.string().default('/'),
  search_timeout:   z.number().int().positive().default(15000),
  min_album_tracks: z.number().int().positive().default(3),
  search:           SlskdSearchSchema.optional(),
  selection:        SlskdSelectionSchema.optional(),
});

const SubsonicSettingsSchema = z.object({
  host:     z.string(),
  username: z.string(),
  password: z.string(),
});

/** @deprecated Use SubsonicSettingsSchema instead */
const NavidromeSettingsSchema = SubsonicSettingsSchema;

const LastFmSettingsSchema = z.object({ api_key: z.string() });

const CatalogListenBrainzSettingsSchema = z.object({ enabled: z.boolean().default(true) });

const BeetsSettingsSchema = z.object({
  enabled: z.boolean(),
  command: z.string().min(1).default('beet import --quiet'),
});

const PathStringSchema = z.preprocess((value) => {
  if (typeof value !== 'string') {
    return value;
  }

  const trimmed = value.trim();

  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"'))
    || (trimmed.startsWith('\'') && trimmed.endsWith('\''))
  ) {
    return trimmed.slice(1, -1).trim();
  }

  return trimmed;
}, z.string().min(1));

const LibraryOrganizeSettingsSchema = z.object({
  enabled:           z.boolean(),
  downloads_path:    PathStringSchema.optional(),
  library_path:      PathStringSchema.optional(),
  organization:      z.enum(['flat', 'artist_album']).default('artist_album'),
  interval:          z.number().int().min(0).default(0),
  auto_organize:     z.boolean().default(false),
  delete_after_move: z.boolean().default(true),
  subsonic_rescan:   z.boolean().default(false),
  navidrome_rescan:  z.boolean().default(false), // deprecated, use subsonic_rescan
  beets:             BeetsSettingsSchema.default({ enabled: false, command: 'beet import --quiet' }),
}).superRefine(requireFieldsWhenEnabled([
  { field: 'downloads_path', message: 'Required when library_organize.enabled is true' },
  { field: 'library_path',   message: 'Required when library_organize.enabled is true' },
])).transform((data) => {
  // Migrate deprecated navidrome_rescan to subsonic_rescan
  if (data.navidrome_rescan && !data.subsonic_rescan) {
    logger.warn('DEPRECATION: library_organize.navidrome_rescan is deprecated, use subsonic_rescan instead');

    return { ...data, subsonic_rescan: data.navidrome_rescan };
  }

  return data;
});

const CatalogDiscoverySettingsSchema = z.object({
  enabled:                   z.boolean(),
  subsonic:                  SubsonicSettingsSchema.optional(),
  navidrome:                 NavidromeSettingsSchema.optional(), // deprecated, use subsonic
  lastfm:                    LastFmSettingsSchema.optional(),
  listenbrainz:              CatalogListenBrainzSettingsSchema.optional(),
  provider_timeout_ms:       z.number().int().positive().optional(),
  max_artists_per_run:       z.number().int().positive(),
  min_similarity:            z.number().min(0).max(1),
  similar_artist_limit:      z.number().int().positive().optional(),
  albums_per_artist:         z.number().int().positive().optional(),
  similarity_cache_ttl_days: z.number().int().min(0).default(30),
  mode:                      z.enum(['auto', 'manual']),
}).transform((data) => {
  // Migrate deprecated navidrome to subsonic (run first so validation sees subsonic)
  if (data.navidrome && !data.subsonic) {
    logger.warn('DEPRECATION: catalog_discovery.navidrome is deprecated, use subsonic instead');

    return { ...data, subsonic: data.navidrome };
  }

  return data;
}).superRefine(requireFieldsWhenEnabled([
  { field: 'subsonic', message: 'Required when catalog_discovery.enabled is true' },
]));

const LibraryDuplicateSettingsSchema = z.object({
  enabled:     z.boolean(),
  auto_reject: z.boolean().optional().default(false),
}).superRefine((value) => {
  if (!value.enabled) {
    return;
  }
  // `catalog_discovery.navidrome` is required for library sync.
  // Validate presence here so users get a clear startup error.
  // (Field-level validation on navidrome happens in CatalogDiscoverySettingsSchema.)
  //
  // Note: We can't access sibling values in this schema; enforced in ConfigSchema below.
});

const SpotifySettingsSchema = z.object({
  enabled:       z.boolean(),
  client_id:     z.string().optional(),
  client_secret: z.string().optional(),
}).superRefine(requireFieldsWhenEnabled([
  { field: 'client_id',     message: 'Required when preview.spotify.enabled is true' },
  { field: 'client_secret', message: 'Required when preview.spotify.enabled is true' },
]));

const PreviewSettingsSchema = z.object({
  enabled: z.boolean().default(true),
  spotify: SpotifySettingsSchema.optional(),
});

export const ConfigSchema = z.object({
  debug:             z.boolean(),
  mode:              z.enum(['album', 'track']),
  fetch_count:       z.number().int().positive(),
  min_score:         z.number().min(0).max(100),
  listenbrainz:      ListenBrainzSettingsSchema.optional(),
  slskd:             SlskdSettingsSchema.optional(),
  catalog_discovery: CatalogDiscoverySettingsSchema,
  library_duplicate: LibraryDuplicateSettingsSchema.optional(),
  library_organize:  LibraryOrganizeSettingsSchema.optional(),
  preview:           PreviewSettingsSchema.optional(),
  ui:                UISettingsSchema,
}).superRefine((value, ctx) => {
  if (value.library_duplicate?.enabled && !value.catalog_discovery?.subsonic) {
    ctx.addIssue({
      code:    'custom',
      message: 'catalog_discovery.subsonic is required when library_duplicate.enabled is true',
      path:    ['catalog_discovery', 'subsonic'],
    });
  }

  if (value.library_organize?.enabled && value.library_organize.subsonic_rescan && !value.catalog_discovery?.subsonic) {
    ctx.addIssue({
      code:    'custom',
      message: 'catalog_discovery.subsonic is required when library_organize.subsonic_rescan is true',
      path:    ['catalog_discovery', 'subsonic'],
    });
  }
});

export type Config = z.infer<typeof ConfigSchema>;
export type AuthSettings = z.infer<typeof AuthSettingsSchema>;
export type UISettings = z.infer<typeof UISettingsSchema>;
export type ListenBrainzSettings = z.infer<typeof ListenBrainzSettingsSchema>;
export type SlskdSettings = z.infer<typeof SlskdSettingsSchema>;
export type SlskdSearchSettings = z.infer<typeof SlskdSearchSchema>;
export type SlskdSearchRetrySettings = z.infer<typeof SlskdSearchRetrySchema>;
export type SlskdQualityPreferencesSettings = z.infer<typeof SlskdQualityPreferencesSchema>;
export type SlskdCompletenessSettings = z.infer<typeof SlskdCompletenessSchema>;
export type SlskdSelectionSettings = z.infer<typeof SlskdSelectionSchema>;
export type CatalogDiscoverySettings = z.infer<typeof CatalogDiscoverySettingsSchema>;
export type LibraryDuplicateSettings = z.infer<typeof LibraryDuplicateSettingsSchema>;
export type LibraryOrganizeSettings = z.infer<typeof LibraryOrganizeSettingsSchema>;
export type PreviewSettings = z.infer<typeof PreviewSettingsSchema>;
export type SpotifySettings = z.infer<typeof SpotifySettingsSchema>;

/**
 * Default configuration values
 */
export const DEFAULT_CONFIG: Config = {
  debug:             false,
  mode:              'album',
  fetch_count:       100,
  min_score:         0,
  catalog_discovery: {
    enabled:                   false,
    max_artists_per_run:       10,
    min_similarity:            0.3,
    mode:                      'manual',
    similarity_cache_ttl_days: 30
  },
  ui: { auth: { enabled: false, type: 'basic' } },
};

/**
 * Section schemas for validation endpoint
 */
export const SECTION_SCHEMAS: Record<string, z.ZodType<unknown>> = {
  listenbrainz:      ListenBrainzSettingsSchema,
  slskd:             SlskdSettingsSchema,
  catalog_discovery: CatalogDiscoverySettingsSchema,
  library_duplicate: LibraryDuplicateSettingsSchema,
  library_organize:  LibraryOrganizeSettingsSchema,
  preview:           PreviewSettingsSchema,
  ui:                UISettingsSchema,
};
