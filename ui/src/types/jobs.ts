export interface JobStatus {
  name:     string;
  running:  boolean;
  lastRun?: string;
  nextRun?: string;
  cron:     string;
}

export interface JobStatusResponse {
  jobs: JobStatus[];
}

export interface TriggerResponse {
  success: boolean;
  message: string;
}

export interface CancelResponse {
  success: boolean;
  message: string;
  jobName: string;
}
