import type { JobStatus, TriggerResponse, CancelResponse } from '@/types/jobs';

import client from './api';

export interface JobStatusResponse {
  jobs: JobStatus[];
}

export async function getJobStatus(): Promise<JobStatusResponse> {
  const response = await client.get<JobStatusResponse>('/jobs/status');

  return response.data;
}

export async function triggerJob(name: string): Promise<TriggerResponse> {
  const response = await client.post<TriggerResponse>(`/jobs/${ name }/trigger`);

  return response.data;
}

export async function cancelJob(name: string): Promise<CancelResponse> {
  const response = await client.post<CancelResponse>(`/jobs/${ name }/cancel`);

  return response.data;
}
