/**
 * Types for slskd API client
 */

/**
 * Search response from slskd containing files from a user
 */
export interface SlskdSearchResponse {
  username:           string;
  files:              SlskdFile[];
  hasFreeUploadSlot?: boolean;
  uploadSpeed?:       number;
}

/**
 * File information from slskd search results
 */
export interface SlskdFile {
  filename: string;
  size?:    number;
}

/**
 * Search result containing the search ID
 */
export interface SlskdSearchResult {
  id: string;
}

/**
 * Search state from slskd
 */
export interface SlskdSearchState {
  state: 'InProgress' | 'Completed' | 'Cancelled';
}

/**
 * Transfer file from slskd downloads API.
 * The `state` field is a comma-separated flags string (e.g., "Completed, Succeeded")
 * rather than a single enum value.
 */
export interface SlskdTransferFile {
  id:               string;
  username:         string;
  direction:        'Download' | 'Upload';
  filename:         string;
  size:             number;
  startOffset:      number;
  state:            string;  // Flags string like "Completed, Succeeded"
  stateDescription: string;
  requestedAt:      string;  // ISO date
  enqueuedAt:       string;  // ISO date
  startedAt?:       string;  // ISO date
  endedAt?:         string;  // ISO date
  bytesTransferred: number;
  averageSpeed:     number;
  bytesRemaining:   number;
  elapsedTime:      string;  // TimeSpan format "00:00:09.9020424"
  percentComplete:  number;  // 0-100
  remainingTime:    string;  // TimeSpan format
}

/**
 * Directory containing transfer files
 */
export interface SlskdTransferDirectory {
  directory: string;
  fileCount: number;
  files:     SlskdTransferFile[];
}

/**
 * User's transfers (downloads or uploads)
 */
export interface SlskdUserTransfers {
  username:    string;
  directories: SlskdTransferDirectory[];
}

/**
 * Result from enqueuing files for download
 */
export interface SlskdEnqueueResult {
  enqueued: SlskdTransferFile[];
  failed:   SlskdTransferFile[];
}
