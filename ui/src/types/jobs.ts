export interface JobStatus {
  name:     string;
  running:  boolean;
  lastRun?: string;
  cron:     string;
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
