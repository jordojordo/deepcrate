/**
 * Types for slskd downloader job processing
 */

import type { SlskdFile, SlskdSearchResponse } from '@server/types/slskd-client';
import type { SearchQueryBuilder } from '@server/services/SearchQueryBuilder';

/**
 * Supported audio formats detected from file extensions
 */
export type AudioFormat = 'flac' | 'wav' | 'alac' | 'aiff' | 'mp3' | 'm4a' | 'aac' | 'ogg' | 'opus' | 'wma' | 'unknown';

/**
 * Quality tier classification
 */
export type QualityTier = 'lossless' | 'high' | 'standard' | 'low' | 'unknown';

/**
 * Extracted quality information from file metadata
 */
export interface QualityInfo {
  format:     AudioFormat;
  bitRate:    number | null;
  bitDepth:   number | null;
  sampleRate: number | null;
  tier:       QualityTier;
}

/**
 * User preferences for audio quality filtering and scoring
 */
export interface QualityPreferences {
  enabled:          boolean;
  preferredFormats: string[];
  minBitrate:       number;
  preferLossless:   boolean;
  rejectLowQuality: boolean;
  rejectLossless:   boolean;
}

/**
 * Entry from the wishlist file with optional year metadata
 */
export interface WishlistEntry {
  artist: string;
  title:  string;
  type:   'album' | 'track';
  year?:  number;
}

/**
 * Selection configuration for manual vs auto mode
 */
export interface SelectionConfig {
  mode:         'auto' | 'manual';
  timeoutHours: number;  // 0 = no timeout
}

/**
 * Configuration for slskd search operations
 */
export interface SearchConfig {
  queryBuilder:         SearchQueryBuilder;
  searchTimeoutMs:      number;
  maxWaitMs:            number;
  minResponseFiles:     number;
  maxResponsesToEval:   number;
  minFileSizeBytes:     number;
  maxFileSizeBytes:     number;
  preferCompleteAlbums: boolean;
  preferAlbumFolder:    boolean;
  retryEnabled:         boolean;
  maxRetryAttempts:     number;
  simplifyOnRetry:      boolean;
  retryDelayMs:         number;
  qualityPreferences?:  QualityPreferences;
  selection:            SelectionConfig;
}

/**
 * Options for selecting files from search results
 */
export interface FileSelectionOptions {
  minFileSizeBytes:     number;
  maxFileSizeBytes:     number;
  preferCompleteAlbums: boolean;
  preferAlbumFolder:    boolean;
  minFiles:             number;
}

/**
 * Successful search result with response and selection
 */
export interface SearchSuccessResult {
  status:    'success';
  response:  SlskdSearchResponse;
  searchId:  string;
  selection: { directory: string; files: SlskdFile[] };
}

/**
 * Failed search result
 */
export interface SearchFailedResult {
  status: 'failed';
}

/**
 * Deferred search result (will retry later)
 */
export interface SearchDeferredResult {
  status: 'deferred';
}

/**
 * Pending selection result (manual mode, waits for user to select)
 */
export interface SearchPendingSelectionResult {
  status:      'pending_selection';
  responses:   SlskdSearchResponse[];
  searchId:    string;
  searchQuery: string;
}

/**
 * Union of all possible search attempt results
 */
export type SearchAttemptResult = SearchSuccessResult | SearchFailedResult | SearchDeferredResult | SearchPendingSelectionResult;

/**
 * Grouped files by directory for UI display
 */
export interface DirectoryGroup {
  path:        string;
  files:       SlskdFile[];
  totalSize:   number;
  qualityInfo: QualityInfo | null;
}

/**
 * Breakdown of individual score components for transparency
 */
export interface ScoreBreakdown {
  hasSlot:           number; // 0 or 100
  qualityScore:      number; // 0-1000
  fileCountScore:    number; // 0-file_count_cap (peaks at expected track count, decays for excess)
  uploadSpeedBonus:  number; // 0-100
  completenessScore: number; // 0-completeness_weight (decays for excess when penalize_excess enabled)
}

/**
 * Search response with scoring info for UI display
 */
export interface ScoredSearchResponse {
  response:            SlskdSearchResponse;
  score:               number;
  scorePercent:        number; // 0-100, score as percentage of theoretical max
  scoreBreakdown:      ScoreBreakdown;
  musicFileCount:      number;
  totalSize:           number;
  qualityInfo:         QualityInfo | null;
  directories:         DirectoryGroup[];
  expectedTrackCount?: number;
  completenessRatio?:  number;
}
