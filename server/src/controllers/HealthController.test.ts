import {
  describe, it, expect, vi, beforeEach, afterEach,
} from 'vitest';
import request from 'supertest';

vi.mock('@server/config/settings', async(importOriginal) => {
  const actual = await importOriginal<typeof import('@server/config/settings')>();

  return {
    ...actual,
    getConfig: vi.fn().mockReturnValue({
      ui:                { auth: { enabled: false } },
      slskd:             {},
      library_organize:  {},
      catalog_discovery: {},
    }),
  };
});

vi.mock('@server/config/jobs', () => ({
  JOB_INTERVALS:  {},
  RUN_ON_STARTUP: false,
  secondsToCron:  vi.fn(),
}));

vi.mock('@server/plugins/jobs', () => ({
  triggerJob:     vi.fn(),
  startJobs:      vi.fn(),
  stopJobs:       vi.fn(),
  getJobStatus:   vi.fn(),
  cancelJob:      vi.fn(),
  isJobCancelled: vi.fn(),
}));

import app from '@server/plugins/app';

describe('HealthController', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('GET /health', () => {
    it('returns 200 with full health response (no auth required)', async() => {
      const response = await request(app).get('/health');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        status:  'ok',
        version: 'dev',
        service: 'deepcrate',
      });
    });
  });
});
