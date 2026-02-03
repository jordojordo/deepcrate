// ============================================================================
// Base Types
// ============================================================================

export type WishlistItemType = 'artist' | 'album' | 'track';
export type WishlistItemSource = 'listenbrainz' | 'catalog' | 'manual';

export interface WishlistEntry {
  id:           string;
  artist:       string;
  title:        string;
  type:         WishlistItemType;
  year?:        number | null;
  mbid?:        string | null;
  source?:      WishlistItemSource | null;
  coverUrl?:    string | null;
  addedAt:      string;
  processedAt?: string | null;
}

// ============================================================================
// Download Status
// ============================================================================

export type DownloadStatus =
  | 'none'               // No download task yet
  | 'pending'            // DownloadTask created, waiting
  | 'searching'          // Searching slskd
  | 'pending_selection'  // Waiting for user selection
  | 'deferred'           // Deferred for later
  | 'queued'             // Queued in slskd
  | 'downloading'        // Actively downloading
  | 'completed'          // Download completed
  | 'failed';            // Download failed

export interface WishlistEntryWithStatus extends WishlistEntry {
  downloadStatus:  DownloadStatus;
  downloadTaskId?: string | null;
  downloadError?:  string | null;
}

// ============================================================================
// Request Types
// ============================================================================

export interface AddWishlistRequest {
  artist: string;
  title:  string;
  type:   WishlistItemType;
  year?:  number;
  mbid?:  string;
}

export interface UpdateWishlistRequest {
  artist?:             string;
  title?:              string;
  type?:               WishlistItemType;
  year?:               number | null;
  mbid?:               string | null;
  source?:             WishlistItemSource | null;
  coverUrl?:           string | null;
  resetDownloadState?: boolean;
}

export interface BulkDeleteRequest {
  ids: string[];
}

export interface BulkRequeueRequest {
  ids: string[];
}

// ============================================================================
// Filters & Sorting
// ============================================================================

export type WishlistSort =
  | 'addedAt_asc' | 'addedAt_desc'
  | 'artist_asc' | 'artist_desc'
  | 'title_asc' | 'title_desc'
  | 'processedAt_asc' | 'processedAt_desc';

export type ProcessedFilter = 'all' | 'pending' | 'processed';

export interface WishlistFilters {
  source?:    WishlistItemSource;
  type?:      WishlistItemType;
  processed?: ProcessedFilter;
  dateFrom?:  string;
  dateTo?:    string;
  search?:    string;
  sort?:      WishlistSort;
  limit?:     number;
  offset?:    number;
}

// ============================================================================
// Response Types
// ============================================================================

export interface PaginatedWishlistResponse {
  entries: WishlistEntryWithStatus[];
  total:   number;
  limit:   number;
  offset:  number;
}

export interface BulkOperationResponse {
  success:  boolean;
  message:  string;
  affected: number;
}

// ============================================================================
// Import/Export
// ============================================================================

export type ExportFormat = 'json';

export interface ImportItem {
  artist:    string;
  title:     string;
  type:      WishlistItemType;
  year?:     number | null;
  mbid?:     string | null;
  source?:   WishlistItemSource | null;
  coverUrl?: string | null;
}

export interface ImportResultItem {
  artist:   string;
  title:    string;
  status:   'added' | 'skipped' | 'error';
  message?: string;
}

export interface ImportResponse {
  success: boolean;
  message: string;
  added:   number;
  skipped: number;
  errors:  number;
  results: ImportResultItem[];
}
