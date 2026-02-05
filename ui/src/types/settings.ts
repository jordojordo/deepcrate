/**
 * Secret field indicator (replaces actual values in API responses)
 */
export interface SecretStatus {
  configured: boolean;
}

/**
 * Valid config section names
 */
export type SettingsSection =
  | 'listenbrainz'
  | 'slskd'
  | 'catalog_discovery'
  | 'library_duplicate'
  | 'library_organize'
  | 'preview'
  | 'ui';

/**
 * ListenBrainz settings
 */
export interface ListenBrainzSettings {
  username:      string;
  token:         SecretStatus;
  approval_mode: 'auto' | 'manual';
  source_type:   'collaborative' | 'weekly_playlist';
}

export interface ListenBrainzFormData {
  username:      string;
  token?:        string;
  approval_mode: 'auto' | 'manual';
  source_type:   'collaborative' | 'weekly_playlist';
}

/**
 * slskd settings
 */
export interface SlskdSettings {
  host:             string;
  api_key:          SecretStatus;
  url_base:         string;
  search_timeout:   number;
  min_album_tracks: number;
  search?:          SlskdSearchSettings;
  selection?:       SlskdSelectionSettings;
}

export interface SlskdSearchSettings {
  album_query_template:   string;
  track_query_template:   string;
  fallback_queries:       string[];
  exclude_terms:          string[];
  min_file_size_mb:       number;
  max_file_size_mb:       number;
  prefer_complete_albums: boolean;
  prefer_album_folder:    boolean;
  retry:                  SlskdRetrySettings;
  quality_preferences?:   SlskdQualitySettings;
}

export interface SlskdRetrySettings {
  enabled:                  boolean;
  max_attempts:             number;
  simplify_on_retry:        boolean;
  delay_between_retries_ms: number;
}

export interface SlskdQualitySettings {
  enabled:            boolean;
  preferred_formats:  string[];
  min_bitrate:        number;
  prefer_lossless:    boolean;
  reject_low_quality: boolean;
  reject_lossless:    boolean;
}

export interface SlskdSelectionSettings {
  mode:          'auto' | 'manual';
  timeout_hours: number;
}

export interface SlskdFormData {
  host:             string;
  api_key?:         string;
  url_base:         string;
  search_timeout:   number;
  min_album_tracks: number;
  search?:          SlskdSearchSettings;
  selection?:       SlskdSelectionSettings;
}

export interface SlskdForm extends Omit<SlskdFormData, 'search' | 'selection'> {
  search:    Required<SlskdSearchSettings>;
  selection: SlskdSelectionSettings;
}

/**
 * Catalog discovery settings
 */
export interface SubsonicSettings {
  host:     string;
  username: string;
  password: SecretStatus;
}

/** @deprecated Use SubsonicSettings instead */
export type NavidromeSettings = SubsonicSettings;

export interface LastFmSettings {
  api_key: SecretStatus;
}

export interface CatalogDiscoverySettings {
  enabled:               boolean;
  subsonic?:             SubsonicSettings;
  lastfm?:               LastFmSettings;
  max_artists_per_run:   number;
  min_similarity:        number;
  similar_artist_limit?: number;
  albums_per_artist?:    number;
  mode:                  'auto' | 'manual';
}

export interface CatalogDiscoveryFormData {
  enabled:   boolean;
  subsonic?: {
    host?:     string;
    username?: string;
    password?: string;
  };
  lastfm?: {
    api_key?: string;
  };
  max_artists_per_run:   number;
  min_similarity:        number;
  similar_artist_limit?: number;
  albums_per_artist?:    number;
  mode:                  'auto' | 'manual';
}

export interface CatalogDiscoveryForm extends Omit<CatalogDiscoveryFormData, 'subsonic' | 'lastfm'> {
  subsonic: { host: string; username: string; password?: string };
  lastfm:   { api_key?: string };
}

/**
 * Preview settings (Spotify)
 */
export interface SpotifySettings {
  enabled:        boolean;
  client_id?:     SecretStatus;
  client_secret?: SecretStatus;
}

export interface PreviewSettings {
  enabled:  boolean;
  spotify?: SpotifySettings;
}

export interface PreviewFormData {
  enabled:  boolean;
  spotify?: {
    enabled:        boolean;
    client_id?:     string;
    client_secret?: string;
  };
}

export interface PreviewForm extends Omit<PreviewFormData, 'spotify'> {
  spotify: { enabled: boolean; client_id?: string; client_secret?: string };
}

/**
 * Auth settings
 */
export interface AuthSettings {
  enabled:   boolean;
  type:      'basic' | 'api_key' | 'proxy';
  username?: string;
  password?: SecretStatus;
  api_key?:  SecretStatus;
}

export interface UISettings {
  auth: AuthSettings;
}

export interface AuthFormData {
  enabled:   boolean;
  type:      'basic' | 'api_key' | 'proxy';
  username?: string;
  password?: string;
  api_key?:  string;
}

/**
 * Library settings
 */
export interface LibraryDuplicateSettings {
  enabled:      boolean;
  auto_reject?: boolean;
}

export interface LibraryOrganizeSettings {
  enabled:           boolean;
  downloads_path?:   string;
  library_path?:     string;
  organization:      'flat' | 'artist_album';
  interval:          number;
  auto_organize:     boolean;
  delete_after_move: boolean;
  subsonic_rescan:   boolean;
  beets?: {
    enabled: boolean;
    command: string;
  };
}

/**
 * Full settings response
 */
export interface SettingsResponse {
  debug:              boolean;
  mode:               'album' | 'track';
  fetch_count:        number;
  min_score:          number;
  listenbrainz?:      ListenBrainzSettings;
  slskd?:             SlskdSettings;
  catalog_discovery:  CatalogDiscoverySettings;
  library_duplicate?: LibraryDuplicateSettings;
  library_organize?:  LibraryOrganizeSettings;
  preview?:           PreviewSettings;
  ui:                 UISettings;
}

/**
 * Section response
 */
export interface SectionResponse<T = unknown> {
  section: string;
  data:    T;
}

/**
 * Update response
 */
export interface UpdateResponse {
  success: boolean;
  message: string;
  section: string;
}

/**
 * UI preferences (localStorage only, not server-persisted)
 */
export interface UIPreferences {
  theme:            'dark' | 'light' | 'system';
  queueViewMode:    'grid' | 'list';
  wishlistViewMode: 'grid' | 'list';
  sidebarCollapsed: boolean;
  itemsPerPage:     number;
}

export const DEFAULT_UI_PREFERENCES: UIPreferences = {
  theme:            'dark',
  queueViewMode:    'grid',
  wishlistViewMode: 'grid',
  sidebarCollapsed: false,
  itemsPerPage:     25,
};
