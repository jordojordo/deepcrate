export type DownloadStatus = 'pending' | 'searching' | 'pending_selection' | 'queued' | 'downloading' | 'deferred' | 'completed' | 'failed';

export type QualityTier = 'lossless' | 'high' | 'standard' | 'low' | 'unknown';

export interface QualityInfo {
  format:     string;
  bitRate:    number | null;
  bitDepth:   number | null;
  sampleRate: number | null;
  tier:       QualityTier;
}

export interface DownloadProgress {
  filesCompleted:         number;
  filesTotal:             number;
  bytesTransferred:       number;
  bytesTotal:             number;
  averageSpeed:           number | null;
  estimatedTimeRemaining: number | null;
}

export interface ActiveDownload {
  id:                  string;
  wishlistKey:         string;
  artist:              string;
  album:               string;
  type:                'album' | 'track';
  status:              DownloadStatus;
  slskdUsername:       string | null;
  slskdDirectory:      string | null;
  fileCount:           number | null;
  quality:             QualityInfo | null;
  progress:            DownloadProgress | null;
  searchQuery?:        string | null;
  selectionExpiresAt?: string | null;
  queuedAt:            string;
  startedAt:           string | null;
}

export interface CompletedDownload {
  id:            string;
  wishlistKey:   string;
  artist:        string;
  album:         string;
  type:          'album' | 'track';
  slskdUsername: string | null;
  fileCount:     number | null;
  queuedAt:      string;
  completedAt:   string;
}

export interface FailedDownload {
  id:           string;
  wishlistKey:  string;
  artist:       string;
  album:        string;
  type:         'album' | 'track';
  errorMessage: string | null;
  retryCount:   number;
  queuedAt:     string;
  completedAt:  string;
}

export interface DownloadStats {
  active:         number;
  queued:         number;
  completed:      number;
  failed:         number;
  totalBandwidth: number | null;
}

export interface DownloadFilters {
  limit:  number;
  offset: number;
}

export interface SlskdFile {
  filename:    string;
  size?:       number;
  bitRate?:    number;
  bitDepth?:   number;
  sampleRate?: number;
  length?:     number;
}

export interface SlskdSearchResponse {
  username:           string;
  files:              SlskdFile[];
  hasFreeUploadSlot?: boolean;
  uploadSpeed?:       number;
}

export interface DirectoryGroup {
  path:        string;
  files:       SlskdFile[];
  totalSize:   number;
  qualityInfo: QualityInfo | null;
}

export interface ScoreBreakdown {
  hasSlot:           number;
  qualityScore:      number;
  fileCountScore:    number;
  uploadSpeedBonus:  number;
  completenessScore: number;
}

export interface ScoredSearchResponse {
  response:            SlskdSearchResponse;
  score:               number;
  scorePercent:        number;
  scoreBreakdown:      ScoreBreakdown;
  musicFileCount:      number;
  totalSize:           number;
  qualityInfo:         QualityInfo | null;
  directories:         DirectoryGroup[];
  expectedTrackCount?: number;
  completenessRatio?:  number;
}

export interface SearchResultsResponse {
  task: {
    id:                 string;
    artist:             string;
    album:              string;
    searchQuery:        string;
    selectionExpiresAt: string | null;
  };
  results:              ScoredSearchResponse[];
  skippedUsernames:     string[];
  minCompletenessRatio: number;
}

export interface RetryRequest {
  ids: string[];
}

export interface DeleteRequest {
  ids: string[];
}
