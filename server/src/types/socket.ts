import type QueueItem from '@server/models/QueueItem';
import type { ActiveDownload, DownloadProgress, DownloadStats } from '@server/types/downloads';

/**
 * Queue namespace event payloads
 */
export interface QueueItemAddedEvent {
  item: QueueItem;
}

export interface QueueItemUpdatedEvent {
  mbid:        string;
  status:      'approved' | 'rejected';
  processedAt: Date;
}

export interface QueueStatsUpdatedEvent {
  pending:   number;
  approved:  number;
  rejected:  number;
  inLibrary: number;
}

/**
 * Downloads namespace event payloads
 */
export interface DownloadTaskCreatedEvent {
  task: ActiveDownload;
}

export interface DownloadTaskUpdatedEvent {
  id:             string;
  status:         string;
  slskdUsername?: string;
  fileCount?:     number;
  errorMessage?:  string;
}

export interface DownloadProgressEvent {
  id:       string;
  progress: DownloadProgress;
}

export interface DownloadStatsUpdatedEvent extends DownloadStats {}

export interface DownloadPendingSelectionEvent {
  id:                 string;
  artist:             string;
  album:              string;
  resultCount:        number;
  selectionExpiresAt: Date | null;
}

export interface DownloadSelectionExpiredEvent {
  id:     string;
  artist: string;
  album:  string;
}

/**
 * Jobs namespace event payloads
 */
export interface JobStartedEvent {
  name:      string;
  startedAt: Date;
}

export interface JobProgressEvent {
  name:     string;
  message:  string;
  current?: number;
  total?:   number;
}

export interface JobCompletedEvent {
  name:     string;
  duration: number;
  stats?:   Record<string, unknown>;
}

export interface JobFailedEvent {
  name:     string;
  error:    string;
  duration: number;
}

export interface JobCancelledEvent {
  name: string;
}

export interface QueueServerToClientEvents {
  'queue:item:added':    (_event: QueueItemAddedEvent) => void;
  'queue:item:updated':  (_event: QueueItemUpdatedEvent) => void;
  'queue:stats:updated': (_event: QueueStatsUpdatedEvent) => void;
}

export interface DownloadsServerToClientEvents {
  'download:task:created':      (_event: DownloadTaskCreatedEvent) => void;
  'download:task:updated':      (_event: DownloadTaskUpdatedEvent) => void;
  'download:progress':          (_event: DownloadProgressEvent) => void;
  'download:stats:updated':     (_event: DownloadStatsUpdatedEvent) => void;
  'download:pending_selection': (_event: DownloadPendingSelectionEvent) => void;
  'download:selection_expired': (_event: DownloadSelectionExpiredEvent) => void;
}

export interface JobsServerToClientEvents {
  'job:started':   (_event: JobStartedEvent) => void;
  'job:progress':  (_event: JobProgressEvent) => void;
  'job:completed': (_event: JobCompletedEvent) => void;
  'job:failed':    (_event: JobFailedEvent) => void;
  'job:cancelled': (_event: JobCancelledEvent) => void;
}

/**
 * Client-to-server events (currently none)
 */
export interface QueueClientToServerEvents {}
export interface DownloadsClientToServerEvents {}
export interface JobsClientToServerEvents {}
