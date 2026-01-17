export type DownloadStatus = 'pending' | 'searching' | 'queued' | 'downloading' | 'deferred' | 'completed' | 'failed';

export interface DownloadProgress {
  filesCompleted:         number;
  filesTotal:             number;
  bytesTransferred:       number;
  bytesTotal:             number;
  averageSpeed:           number | null;
  estimatedTimeRemaining: number | null;
}

export interface ActiveDownload {
  id:             string;
  wishlistKey:    string;
  artist:         string;
  album:          string;
  type:           'album' | 'track';
  status:         DownloadStatus;
  slskdUsername:  string | null;
  slskdDirectory: string | null;
  fileCount:      number | null;
  progress:       DownloadProgress | null;
  queuedAt:       string;
  startedAt:      string | null;
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
