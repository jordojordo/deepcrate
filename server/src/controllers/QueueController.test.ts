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

const { mockService, mockTriggerJob } = vi.hoisted(() => ({
  mockService: {
    getPending:        vi.fn(),
    approve:           vi.fn(),
    approveAll:        vi.fn(),
    reject:            vi.fn(),
    getStats:          vi.fn(),
    getDistinctGenres: vi.fn(),
  },
  mockTriggerJob: vi.fn(),
}));

vi.mock('@server/services/QueueService', () => ({
  QueueService: class {
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
  triggerJob:     mockTriggerJob,
  startJobs:      vi.fn(),
  stopJobs:       vi.fn(),
  getJobStatus:   vi.fn(),
  cancelJob:      vi.fn(),
  isJobCancelled: vi.fn(),
}));

import app from '@server/plugins/app';
import { getConfig } from '@server/config/settings';
import { JOB_NAMES } from '@server/constants/jobs';
import { AUTH_HEADER, AUTH_CONFIG } from '@server/tests/helpers/auth';

const mockGetConfig = vi.mocked(getConfig);

function makeMockItem(overrides: Record<string, unknown> = {}) {
  return {
    artist:      'Test Artist',
    album:       'Test Album',
    title:       null,
    mbid:        'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
    type:        'album',
    addedAt:     new Date('2025-01-15T12:00:00Z'),
    score:       0.85,
    source:      'listenbrainz',
    similarTo:   ['Artist A', 'Artist B'],
    sourceTrack: 'Some Track',
    coverUrl:    'https://example.com/cover.jpg',
    year:        2024,
    inLibrary:   false,
    ...overrides,
  };
}

describe('QueueController', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetConfig.mockReturnValue(AUTH_CONFIG as any);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('Auth', () => {
    it('returns 401 without auth header on a protected endpoint', async() => {
      const response = await request(app).get('/api/v1/queue/pending');

      expect(response.status).toBe(401);
      expect(response.body).toMatchObject({
        error: true,
        code:  'unauthorized',
      });
    });
  });

  describe('GET /api/v1/queue/pending', () => {
    it('returns paginated items with defaults', async() => {
      const items = [makeMockItem(), makeMockItem({ mbid: 'ffffffff-0000-1111-2222-333333333333', artist: 'Another Artist' })];

      mockService.getPending.mockResolvedValue({ items, total: 2 });

      const response = await request(app)
        .get('/api/v1/queue/pending')
        .set('Authorization', AUTH_HEADER);

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        items:  expect.any(Array),
        total:  2,
        limit:  50,
        offset: 0,
      });
      expect(response.body.items).toHaveLength(2);
      expect(response.body.items[0]).toEqual({
        artist:       'Test Artist',
        album:        'Test Album',
        title:        null,
        mbid:         'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
        type:         'album',
        added_at:     '2025-01-15T12:00:00.000Z',
        score:        0.85,
        source:       'listenbrainz',
        similar_to:   ['Artist A', 'Artist B'],
        source_track: 'Some Track',
        cover_url:    'https://example.com/cover.jpg',
        year:         2024,
        in_library:   false,
      });

      expect(mockService.getPending).toHaveBeenCalledWith({
        source:        'all',
        sort:          'added_at',
        order:         'desc',
        limit:         50,
        offset:        0,
        hideInLibrary: false,
        genres:        undefined,
      });
    });

    it('passes filter params to the service', async() => {
      mockService.getPending.mockResolvedValue({ items: [], total: 0 });

      const response = await request(app)
        .get('/api/v1/queue/pending')
        .query({
          source:          'catalog',
          sort:            'score',
          order:           'asc',
          limit:           10,
          offset:          20,
          hide_in_library: 'true',
        })
        .set('Authorization', AUTH_HEADER);

      expect(response.status).toBe(200);
      expect(mockService.getPending).toHaveBeenCalledWith({
        source:        'catalog',
        sort:          'score',
        order:         'asc',
        limit:         10,
        offset:        20,
        hideInLibrary: true,
        genres:        undefined,
      });
    });

    it('returns 400 for invalid params', async() => {
      const response = await request(app)
        .get('/api/v1/queue/pending')
        .query({ limit: -1 })
        .set('Authorization', AUTH_HEADER);

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        error: true,
        code:  'validation_error',
      });
    });

    it('returns 500 on service error', async() => {
      mockService.getPending.mockRejectedValue(new Error('DB failure'));

      const response = await request(app)
        .get('/api/v1/queue/pending')
        .set('Authorization', AUTH_HEADER);

      expect(response.status).toBe(500);
      expect(response.body).toMatchObject({
        error:   true,
        code:    'internal_error',
        message: 'Failed to fetch pending items',
      });
    });
  });

  describe('POST /api/v1/queue/approve', () => {
    it('approves by mbid array', async() => {
      const mbids = ['mbid-1', 'mbid-2'];

      mockService.approve.mockResolvedValue(2);

      const response = await request(app)
        .post('/api/v1/queue/approve')
        .set('Authorization', AUTH_HEADER)
        .send({ mbids });

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        count:   2,
        message: 'Approved 2 items',
      });
      expect(mockService.approve).toHaveBeenCalledWith(mbids);
      expect(mockService.approveAll).not.toHaveBeenCalled();
    });

    it('approves all pending items', async() => {
      mockService.approveAll.mockResolvedValue(5);

      const response = await request(app)
        .post('/api/v1/queue/approve')
        .set('Authorization', AUTH_HEADER)
        .send({ all: true });

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        count:   5,
        message: 'Approved all 5 pending items',
      });
      expect(mockService.approveAll).toHaveBeenCalled();
      expect(mockService.approve).not.toHaveBeenCalled();
    });

    it('triggers slskd job when count > 0', async() => {
      mockService.approve.mockResolvedValue(1);

      await request(app)
        .post('/api/v1/queue/approve')
        .set('Authorization', AUTH_HEADER)
        .send({ mbids: ['mbid-1'] });

      expect(mockTriggerJob).toHaveBeenCalledWith(JOB_NAMES.SLSKD);
    });

    it('skips slskd job when count is 0', async() => {
      mockService.approve.mockResolvedValue(0);

      await request(app)
        .post('/api/v1/queue/approve')
        .set('Authorization', AUTH_HEADER)
        .send({ mbids: ['non-existent'] });

      expect(mockTriggerJob).not.toHaveBeenCalled();
    });

    it('returns 400 when neither mbids nor all provided', async() => {
      const response = await request(app)
        .post('/api/v1/queue/approve')
        .set('Authorization', AUTH_HEADER)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        error: true,
        code:  'validation_error',
      });
      expect(response.body.message).toContain("'mbids'");
    });
  });

  describe('POST /api/v1/queue/reject', () => {
    it('rejects by mbid array', async() => {
      const mbids = ['mbid-1', 'mbid-2'];

      mockService.reject.mockResolvedValue(2);

      const response = await request(app)
        .post('/api/v1/queue/reject')
        .set('Authorization', AUTH_HEADER)
        .send({ mbids });

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        count:   2,
        message: 'Rejected 2 items',
      });
      expect(mockService.reject).toHaveBeenCalledWith(mbids);
    });

    it('returns 400 for missing mbids', async() => {
      const response = await request(app)
        .post('/api/v1/queue/reject')
        .set('Authorization', AUTH_HEADER)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        error: true,
        code:  'validation_error',
      });
    });
  });

  describe('GET /api/v1/queue/pending with genres filter', () => {
    it('passes parsed genres to the service', async() => {
      mockService.getPending.mockResolvedValue({ items: [], total: 0 });

      const response = await request(app)
        .get('/api/v1/queue/pending')
        .query({ genres: 'rock,jazz' })
        .set('Authorization', AUTH_HEADER);

      expect(response.status).toBe(200);
      expect(mockService.getPending).toHaveBeenCalledWith(
        expect.objectContaining({ genres: ['rock', 'jazz'] })
      );
    });

    it('includes genres in response items', async() => {
      const items = [makeMockItem({ genres: ['electronic', 'ambient'] })];

      mockService.getPending.mockResolvedValue({ items, total: 1 });

      const response = await request(app)
        .get('/api/v1/queue/pending')
        .set('Authorization', AUTH_HEADER);

      expect(response.status).toBe(200);
      expect(response.body.items[0].genres).toEqual(['electronic', 'ambient']);
    });
  });

  describe('GET /api/v1/queue/genres', () => {
    it('returns genres array', async() => {
      mockService.getDistinctGenres.mockResolvedValue(['ambient', 'electronic', 'jazz']);

      const response = await request(app)
        .get('/api/v1/queue/genres')
        .set('Authorization', AUTH_HEADER);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ genres: ['ambient', 'electronic', 'jazz'] });
    });

    it('returns 500 on service error', async() => {
      mockService.getDistinctGenres.mockRejectedValue(new Error('DB failure'));

      const response = await request(app)
        .get('/api/v1/queue/genres')
        .set('Authorization', AUTH_HEADER);

      expect(response.status).toBe(500);
      expect(response.body).toMatchObject({
        error:   true,
        code:    'internal_error',
        message: 'Failed to fetch genres',
      });
    });
  });

  describe('GET /api/v1/queue/stats', () => {
    it('returns stats object', async() => {
      const stats = {
        pending:  10,
        approved: 25,
        rejected: 5,
        total:    40,
      };

      mockService.getStats.mockResolvedValue(stats);

      const response = await request(app)
        .get('/api/v1/queue/stats')
        .set('Authorization', AUTH_HEADER);

      expect(response.status).toBe(200);
      expect(response.body).toEqual(stats);
      expect(mockService.getStats).toHaveBeenCalled();
    });

    it('returns 500 on service error', async() => {
      mockService.getStats.mockRejectedValue(new Error('Stats failure'));

      const response = await request(app)
        .get('/api/v1/queue/stats')
        .set('Authorization', AUTH_HEADER);

      expect(response.status).toBe(500);
      expect(response.body).toMatchObject({
        error:   true,
        code:    'internal_error',
        message: 'Failed to fetch queue stats',
      });
    });
  });
});
