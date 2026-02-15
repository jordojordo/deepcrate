import type { HealthResponse } from '@/types/api';

import axios from 'axios';

export async function fetchHealth(): Promise<HealthResponse | undefined> {
  try {
    const { data } = await axios.get('/health');

    return data;
  } catch {
    throw new Error('Failed to fetch health check');
  }
}
