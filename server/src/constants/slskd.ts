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
export const MUSIC_EXTENSIONS = ['.mp3', '.flac', '.m4a', '.ogg', '.opus', '.wav', '.aac', '.wma', '.alac'];
