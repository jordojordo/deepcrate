import type { QueueItem } from './queue';
import type { ActiveDownload, DownloadProgress, DownloadStats } from './downloads';

/**
 * Queue namespace event payloads
 */
export interface QueueItemAddedEvent {
  item: QueueItem;
}

export interface QueueItemUpdatedEvent {
  mbid:        string;
  status:      'approved' | 'rejected';
  processedAt: string;
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

export type DownloadStatsUpdatedEvent = DownloadStats;

/**
 * Jobs namespace event payloads
 */
export interface JobStartedEvent {
  name:      string;
  startedAt: string;
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

/**
 * Socket namespaces
 */
export type SocketNamespace = '/queue' | '/downloads' | '/jobs';
