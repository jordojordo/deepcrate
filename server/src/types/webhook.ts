export type WebhookEvent =
  | 'download_completed'
  | 'queue_approved'
  | 'queue_rejected';

export interface WebhookConfig {
  name:       string;
  enabled:    boolean;
  url:        string;
  secret?:    string;
  events:     WebhookEvent[];
  timeout_ms: number;
  retry:      number;
}

export interface WebhookPayload {
  event:     WebhookEvent;
  timestamp: string;
  data: {
    artist?:        string;
    album?:         string;
    download_path?: string;
    mbid?:          string;
  };
}

export interface WebhookExecutionResult {
  success:     boolean;
  statusCode?: number;
  duration:    number;
  error?:      string;
}
