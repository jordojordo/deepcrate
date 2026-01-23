/**
 * Constants for slskd downloader job
 */

/** Default search timeout in milliseconds */
export const SEARCH_TIMEOUT_MS = 15000;

/** Interval between search state polling in milliseconds */
export const SEARCH_POLL_INTERVAL_MS = 1000;

/** Maximum time to wait for search completion in milliseconds */
export const SEARCH_MAX_WAIT_MS = 20000;

/** Minimum number of files expected for an album download */
export const MIN_FILES_ALBUM = 3;

/** Minimum number of files expected for a track download */
export const MIN_FILES_TRACK = 1;

/** Conversion factor from megabytes to bytes */
export const MB_TO_BYTES = 1024 * 1024;

/** Common music file extensions to filter search results */
export const MUSIC_EXTENSIONS = ['.mp3', '.flac', '.m4a', '.ogg', '.opus', '.wav', '.aac', '.wma', '.alac', '.aiff'];

/** Lossless audio format extensions */
export const LOSSLESS_FORMATS = ['.flac', '.wav', '.alac', '.aiff'];

/** Bitrate threshold for high quality (320+ kbps) */
export const HIGH_QUALITY_BITRATE = 320;

/** Bitrate threshold for standard quality (256-319 kbps) */
export const STANDARD_QUALITY_BITRATE = 256;

/** Bitrate threshold for low quality (below this is considered very low) */
export const LOW_QUALITY_BITRATE = 96;

/** Quality scores for ranking purposes */
export const QUALITY_SCORES = {
  lossless: 1000,
  high:     500,
  standard: 200,
  low:      50,
  unknown:  100,
} as const;

/** Default preferred audio formats for quality filtering */
export const DEFAULT_PREFERRED_FORMATS = ['flac', 'wav', 'alac', 'mp3', 'm4a', 'ogg'] as const;

/** Quality tier order from highest to lowest quality */
export const QUALITY_TIER_ORDER = ['lossless', 'high', 'standard', 'low', 'unknown'] as const;

/** Maximum search results to store for manual selection (limits memory usage) */
export const MAX_STORED_SELECTION_RESULTS = 15;
