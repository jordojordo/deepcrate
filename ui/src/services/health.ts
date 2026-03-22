import type { HealthResponse } from '@/types/api';

export async function fetchHealth(): Promise<HealthResponse | undefined> {
  try {
    const response = await fetch('/health');

    if (!response.ok) {
      throw new Error(`Health check failed: ${ response.status }`);
    }

    return await response.json() as HealthResponse;
  } catch {
    throw new Error('Failed to fetch health check');
  }
}
