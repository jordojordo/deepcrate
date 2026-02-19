import {
  describe, it, expect, vi, beforeEach,
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

const { mockService } = vi.hoisted(() => ({ mockService: { getRecent: vi.fn() } }));

vi.mock('@server/services/ActivityService', () => ({
  ActivityService: class {
    constructor() {
      return mockService; 
    } 
  } 
}));

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
import { getConfig } from '@server/config/settings';
import { AUTH_HEADER, AUTH_CONFIG } from '@server/tests/helpers/auth';

const mockGetConfig = vi.mocked(getConfig);

describe('ActivityController', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetConfig.mockReturnValue(AUTH_CONFIG as any);
  });

  describe('GET /api/v1/activity/recent', () => {
    it('returns paginated activity items', async() => {
      const mockItems = [
        {
          id:          'queue-1',
          title:       'Artist - Album',
          description: 'Approved',
          timestamp:   '2025-01-15T12:00:00.000Z',
          type:        'approved',
          coverUrl:    'https://example.com/cover.jpg',
        },
      ];

      mockService.getRecent.mockResolvedValue({ items: mockItems, total: 1 });

      const res = await request(app)
        .get('/api/v1/activity/recent')
        .set('Authorization', AUTH_HEADER);

      expect(res.status).toBe(200);
      expect(res.body.items).toEqual(mockItems);
      expect(res.body.total).toBe(1);
      expect(res.body.limit).toBe(10);
      expect(res.body.offset).toBe(0);
      expect(mockService.getRecent).toHaveBeenCalledWith({ limit: 10, offset: 0 });
    });

    it('accepts custom limit parameter', async() => {
      mockService.getRecent.mockResolvedValue({ items: [], total: 0 });

      const res = await request(app)
        .get('/api/v1/activity/recent?limit=25')
        .set('Authorization', AUTH_HEADER);

      expect(res.status).toBe(200);
      expect(mockService.getRecent).toHaveBeenCalledWith({ limit: 25, offset: 0 });
    });

    it('accepts offset parameter', async() => {
      mockService.getRecent.mockResolvedValue({ items: [], total: 100 });

      const res = await request(app)
        .get('/api/v1/activity/recent?limit=50&offset=50')
        .set('Authorization', AUTH_HEADER);

      expect(res.status).toBe(200);
      expect(res.body.offset).toBe(50);
      expect(mockService.getRecent).toHaveBeenCalledWith({ limit: 50, offset: 50 });
    });

    it('rejects limit over 50', async() => {
      const res = await request(app)
        .get('/api/v1/activity/recent?limit=100')
        .set('Authorization', AUTH_HEADER);

      expect(res.status).toBe(400);
    });

    it('requires authentication', async() => {
      const res = await request(app)
        .get('/api/v1/activity/recent');

      expect(res.status).toBe(401);
    });
  });
});
