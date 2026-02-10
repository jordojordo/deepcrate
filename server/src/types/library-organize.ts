import type DownloadTask from '@server/models/DownloadTask';

export type OrganizePhase = 'finding_files' | 'running_beets' | 'transferring' | 'cleanup' | 'complete';

export interface OrganizeResult {
  status:           'organized' | 'skipped' | 'failed';
  message:          string;
  sourcePath?:      string;
  destinationPath?: string;
}

export interface OrganizeCallbacks {
  onTaskStart?:    (_task: DownloadTask) => void;
  onPhase?:        (_task: DownloadTask, _phase: OrganizePhase, _detail?: string) => void;
  onFileProgress?: (_task: DownloadTask, _current: number, _total: number, _filename: string) => void;
  onTaskComplete?: (_task: DownloadTask, _result: OrganizeResult) => void;
  isCancelled?:    () => boolean;
}

export interface FoundDownload {
  sourcePath:    string;
  sourceDirName: string;
}
