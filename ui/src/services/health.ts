import type { HealthResponse } from '@/types/api';

import client from './api';

export async function fetchHealth(): Promise<HealthResponse | undefined> {
  try {
    const { data } = await client.get('/health');

    return data;
  } catch {
    throw new Error('Failed to fetch health check');
  }
}
