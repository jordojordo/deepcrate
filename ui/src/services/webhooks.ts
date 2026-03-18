import client from './api';

export interface WebhookTestRequest {
  url:         string;
  secret?:     string;
  timeout_ms?: number;
  dry_run?:    boolean;
}

export interface WebhookTestResult {
  success:     boolean;
  dry_run?:    boolean;
  statusCode?: number;
  duration?:   number;
  error?:      string;
  payload?:    unknown;
}

export async function testWebhook(data: WebhookTestRequest): Promise<WebhookTestResult> {
  const response = await client.post<WebhookTestResult>('/webhooks/test', data);

  return response.data;
}
