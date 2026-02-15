import {
  describe, it, expect, vi, beforeEach, afterEach,
} from 'vitest';
import request from 'supertest';

vi.mock('@server/config/settings', async(importOriginal) => {
  const actual = await importOriginal<typeof import('@server/config/settings')>();

  return { ...actual, getConfig: vi.fn().mockReturnValue({}) };
});

const mockService = vi.hoisted(() => ({
  getActive:          vi.fn(),
  getCompleted:       vi.fn(),
  getFailed:          vi.fn(),
  retry:              vi.fn(),
  delete:             vi.fn(),
  getStats:           vi.fn(),
  getSearchResults:   vi.fn(),
  selectSearchResult: vi.fn(),
  skipSearchResult:   vi.fn(),
  retrySearch:        vi.fn(),
  autoSelectBest:     vi.fn(),
}));

vi.mock('@server/services/DownloadService', () => ({
  DownloadService: class {
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

const TEST_UUID = '550e8400-e29b-41d4-a716-446655440000';
const TEST_UUID_2 = '550e8400-e29b-41d4-a716-446655440001';

function makeActiveDownload(overrides: Record<string, unknown> = {}) {
  return {
    id:              TEST_UUID,
    artist:          'Test Artist',
    album:           'Test Album',
    status:          'downloading',
    progress:        45,
    totalBytes:      1024000,
    downloadedBytes: 460800,
    speed:           512,
    ...overrides,
  };
}

function makeDownloadModel(overrides: Record<string, unknown> = {}) {
  return {
    id:              TEST_UUID,
    wishlistKey:     'test-artist-test-album',
    artist:          'Test Artist',
    album:           'Test Album',
    type:            'album',
    status:          'completed',
    downloadPath:    '/downloads/Test Artist - Test Album',
    slskdUsername:   'user123',
    slskdDirectory:  '@@user123\\Music\\Test Album',
    fileCount:       10,
    errorMessage:    null,
    retryCount:      0,
    queuedAt:        '2025-01-15T12:00:00.000Z',
    startedAt:       '2025-01-15T12:05:00.000Z',
    completedAt:     '2025-01-15T12:10:00.000Z',
    ...overrides,
  };
}

describe('DownloadsController', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetConfig.mockReturnValue(AUTH_CONFIG as any);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('Auth', () => {
    it('returns 401 without auth header on a protected endpoint', async() => {
      const response = await request(app).get('/api/v1/downloads/active');

      expect(response.status).toBe(401);
      expect(response.body).toMatchObject({
        error: true,
        code:  'unauthorized',
      });
    });
  });

  describe('GET /api/v1/downloads/active', () => {
    it('returns paginated active downloads', async() => {
      const items = [makeActiveDownload()];

      mockService.getActive.mockResolvedValue({ items, total: 1 });

      const response = await request(app)
        .get('/api/v1/downloads/active')
        .set('Authorization', AUTH_HEADER);

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        items:  expect.any(Array),
        total:  1,
        limit:  50,
        offset: 0,
      });
      expect(response.body.items).toHaveLength(1);
      expect(mockService.getActive).toHaveBeenCalledWith({ limit: 50, offset: 0 });
    });

    it('accepts limit and offset params', async() => {
      mockService.getActive.mockResolvedValue({ items: [], total: 0 });

      const response = await request(app)
        .get('/api/v1/downloads/active')
        .query({ limit: 10, offset: 20 })
        .set('Authorization', AUTH_HEADER);

      expect(response.status).toBe(200);
      expect(mockService.getActive).toHaveBeenCalledWith({ limit: 10, offset: 20 });
    });

    it('returns 400 for invalid params', async() => {
      const response = await request(app)
        .get('/api/v1/downloads/active')
        .query({ limit: -1 })
        .set('Authorization', AUTH_HEADER);

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        error: true,
        code:  'validation_error',
      });
    });
  });

  describe('GET /api/v1/downloads/completed', () => {
    it('returns paginated completed downloads', async() => {
      const items = [makeDownloadModel({ status: 'completed' })];

      mockService.getCompleted.mockResolvedValue({ items, total: 1 });

      const response = await request(app)
        .get('/api/v1/downloads/completed')
        .set('Authorization', AUTH_HEADER);

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        items:  expect.any(Array),
        total:  1,
        limit:  50,
        offset: 0,
      });
      expect(response.body.items).toHaveLength(1);
      expect(response.body.items[0]).toMatchObject({
        id:     TEST_UUID,
        artist: 'Test Artist',
        album:  'Test Album',
        status: 'completed',
      });
    });

    it('returns 500 on service error', async() => {
      mockService.getCompleted.mockRejectedValue(new Error('DB failure'));

      const response = await request(app)
        .get('/api/v1/downloads/completed')
        .set('Authorization', AUTH_HEADER);

      expect(response.status).toBe(500);
      expect(response.body).toMatchObject({
        error:   true,
        code:    'internal_error',
        message: 'Failed to fetch completed downloads',
      });
    });
  });

  describe('GET /api/v1/downloads/failed', () => {
    it('returns paginated failed downloads', async() => {
      const items = [makeDownloadModel({
        status:       'failed',
        errorMessage: 'Connection timeout',
        completedAt:  null,
      })];

      mockService.getFailed.mockResolvedValue({ items, total: 1 });

      const response = await request(app)
        .get('/api/v1/downloads/failed')
        .set('Authorization', AUTH_HEADER);

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        items:  expect.any(Array),
        total:  1,
        limit:  50,
        offset: 0,
      });
      expect(response.body.items).toHaveLength(1);
      expect(response.body.items[0]).toMatchObject({
        status:       'failed',
        errorMessage: 'Connection timeout',
      });
    });
  });

  describe('POST /api/v1/downloads/retry', () => {
    it('retries downloads by IDs', async() => {
      mockService.retry.mockResolvedValue({
        success: 2, failed: 0, failures: [] 
      });

      const response = await request(app)
        .post('/api/v1/downloads/retry')
        .set('Authorization', AUTH_HEADER)
        .send({ ids: [TEST_UUID, TEST_UUID_2] });

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success:  true,
        count:    2,
        message:  'Retried 2 downloads, 0 failed',
        failures: [],
      });
      expect(mockService.retry).toHaveBeenCalledWith([TEST_UUID, TEST_UUID_2]);
    });

    it('returns 400 for invalid UUIDs', async() => {
      const response = await request(app)
        .post('/api/v1/downloads/retry')
        .set('Authorization', AUTH_HEADER)
        .send({ ids: ['not-a-uuid'] });

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        error: true,
        code:  'validation_error',
      });
    });

    it('returns 400 for empty array', async() => {
      const response = await request(app)
        .post('/api/v1/downloads/retry')
        .set('Authorization', AUTH_HEADER)
        .send({ ids: [] });

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        error: true,
        code:  'validation_error',
      });
    });
  });

  describe('DELETE /api/v1/downloads', () => {
    it('deletes downloads by IDs', async() => {
      mockService.delete.mockResolvedValue({
        success: 1, failed: 0, failures: [] 
      });

      const response = await request(app)
        .delete('/api/v1/downloads')
        .set('Authorization', AUTH_HEADER)
        .send({ ids: [TEST_UUID] });

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success:  true,
        count:    1,
        message:  'Deleted 1 download(s)',
        failures: [],
      });
      expect(mockService.delete).toHaveBeenCalledWith([TEST_UUID]);
    });

    it('returns 400 for empty array', async() => {
      const response = await request(app)
        .delete('/api/v1/downloads')
        .set('Authorization', AUTH_HEADER)
        .send({ ids: [] });

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        error: true,
        code:  'validation_error',
      });
    });
  });

  describe('GET /api/v1/downloads/stats', () => {
    it('returns download stats', async() => {
      const stats = {
        active:         5,
        queued:         3,
        completed:      10,
        failed:         2,
        totalBandwidth: 1024,
      };

      mockService.getStats.mockResolvedValue(stats);

      const response = await request(app)
        .get('/api/v1/downloads/stats')
        .set('Authorization', AUTH_HEADER);

      expect(response.status).toBe(200);
      expect(response.body).toEqual(stats);
      expect(mockService.getStats).toHaveBeenCalled();
    });

    it('returns 500 on service error', async() => {
      mockService.getStats.mockRejectedValue(new Error('Stats failure'));

      const response = await request(app)
        .get('/api/v1/downloads/stats')
        .set('Authorization', AUTH_HEADER);

      expect(response.status).toBe(500);
      expect(response.body).toMatchObject({
        error:   true,
        code:    'internal_error',
        message: 'Failed to fetch download stats',
      });
    });
  });

  describe('GET /api/v1/downloads/:id/search-results', () => {
    it('returns search results for a task', async() => {
      const searchResults = {
        id:      TEST_UUID,
        results: [{ username: 'user1', files: 10 }],
      };

      mockService.getSearchResults.mockResolvedValue(searchResults);

      const response = await request(app)
        .get(`/api/v1/downloads/${ TEST_UUID }/search-results`)
        .set('Authorization', AUTH_HEADER);

      expect(response.status).toBe(200);
      expect(response.body).toEqual(searchResults);
      expect(mockService.getSearchResults).toHaveBeenCalledWith(TEST_UUID);
    });

    it('returns 404 when task not found', async() => {
      mockService.getSearchResults.mockResolvedValue(null);

      const response = await request(app)
        .get(`/api/v1/downloads/${ TEST_UUID }/search-results`)
        .set('Authorization', AUTH_HEADER);

      expect(response.status).toBe(404);
      expect(response.body).toMatchObject({
        success: false,
        error:   'Task not found or not pending selection',
      });
    });
  });

  describe('POST /api/v1/downloads/:id/select', () => {
    it('selects a search result successfully', async() => {
      mockService.selectSearchResult.mockResolvedValue({ success: true });

      const response = await request(app)
        .post(`/api/v1/downloads/${ TEST_UUID }/select`)
        .set('Authorization', AUTH_HEADER)
        .send({ username: 'user123', directory: '@@user123\\Music' });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ success: true });
      expect(mockService.selectSearchResult).toHaveBeenCalledWith(
        TEST_UUID,
        'user123',
        '@@user123\\Music',
      );
    });

    it('returns 400 for missing username', async() => {
      const response = await request(app)
        .post(`/api/v1/downloads/${ TEST_UUID }/select`)
        .set('Authorization', AUTH_HEADER)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        error: true,
        code:  'validation_error',
      });
    });

    it('returns 404 when task not found', async() => {
      mockService.selectSearchResult.mockResolvedValue({
        success: false,
        error:   'Task not found',
      });

      const response = await request(app)
        .post(`/api/v1/downloads/${ TEST_UUID }/select`)
        .set('Authorization', AUTH_HEADER)
        .send({ username: 'user123' });

      expect(response.status).toBe(404);
      expect(response.body).toMatchObject({
        success: false,
        error:   'Task not found',
      });
    });

    it('returns 410 when selection expired', async() => {
      mockService.selectSearchResult.mockResolvedValue({
        success: false,
        error:   'Selection expired',
      });

      const response = await request(app)
        .post(`/api/v1/downloads/${ TEST_UUID }/select`)
        .set('Authorization', AUTH_HEADER)
        .send({ username: 'user123' });

      expect(response.status).toBe(410);
      expect(response.body).toMatchObject({
        success: false,
        error:   'Selection expired',
      });
    });
  });

  describe('POST /api/v1/downloads/:id/skip', () => {
    it('skips a search result', async() => {
      mockService.skipSearchResult.mockResolvedValue({ success: true });

      const response = await request(app)
        .post(`/api/v1/downloads/${ TEST_UUID }/skip`)
        .set('Authorization', AUTH_HEADER)
        .send({ username: 'user123' });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ success: true });
      expect(mockService.skipSearchResult).toHaveBeenCalledWith(TEST_UUID, 'user123');
    });

    it('returns 400 for missing username', async() => {
      const response = await request(app)
        .post(`/api/v1/downloads/${ TEST_UUID }/skip`)
        .set('Authorization', AUTH_HEADER)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        error: true,
        code:  'validation_error',
      });
    });
  });

  describe('POST /api/v1/downloads/:id/retry-search', () => {
    it('retries search successfully', async() => {
      mockService.retrySearch.mockResolvedValue({ success: true });

      const response = await request(app)
        .post(`/api/v1/downloads/${ TEST_UUID }/retry-search`)
        .set('Authorization', AUTH_HEADER)
        .send({});

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ success: true });
      expect(mockService.retrySearch).toHaveBeenCalledWith(TEST_UUID, undefined);
    });
  });

  describe('POST /api/v1/downloads/:id/auto-select', () => {
    it('auto-selects the best result', async() => {
      mockService.autoSelectBest.mockResolvedValue({ success: true });

      const response = await request(app)
        .post(`/api/v1/downloads/${ TEST_UUID }/auto-select`)
        .set('Authorization', AUTH_HEADER)
        .send({});

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ success: true });
      expect(mockService.autoSelectBest).toHaveBeenCalledWith(TEST_UUID);
    });

    it('returns 404 when task not found', async() => {
      mockService.autoSelectBest.mockResolvedValue({
        success: false,
        error:   'Task not found',
      });

      const response = await request(app)
        .post(`/api/v1/downloads/${ TEST_UUID }/auto-select`)
        .set('Authorization', AUTH_HEADER)
        .send({});

      expect(response.status).toBe(404);
      expect(response.body).toMatchObject({
        success: false,
        error:   'Task not found',
      });
    });
  });
});
