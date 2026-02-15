import {
  describe, it, expect, vi, beforeEach, afterEach,
} from 'vitest';
import request from 'supertest';

const mockService = vi.hoisted(() => ({
  getAll:                 vi.fn(),
  append:                 vi.fn(),
  removeById:             vi.fn(),
  getPaginatedWithStatus: vi.fn(),
  updateById:             vi.fn(),
  bulkDelete:             vi.fn(),
  bulkRequeue:            vi.fn(),
  exportItems:            vi.fn(),
  importItems:            vi.fn(),
}));

const mockGetConfig = vi.hoisted(() => vi.fn().mockReturnValue({
  ui:                { auth: { enabled: false, type: 'basic' } },
  slskd:             {},
  library_organize:  {},
  catalog_discovery: {},
}));


vi.mock('@server/services/WishlistService', () => {
  class MockWishlistService {
    constructor() {
      return mockService; 
    }
  }

  return { WishlistService: MockWishlistService, default: MockWishlistService };
});

vi.mock('@server/config/settings', async(importOriginal) => {
  const actual = await importOriginal<typeof import('@server/config/settings')>();

  return { ...actual, getConfig: mockGetConfig };
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
import { AUTH_HEADER, AUTH_CONFIG } from '@server/tests/helpers/auth';

const TEST_ID  = '550e8400-e29b-41d4-a716-446655440000';
const TEST_ID2 = '550e8400-e29b-41d4-a716-446655440001';

const wishlistItem = {
  id:          TEST_ID,
  artist:      'Radiohead',
  album:       'OK Computer',
  type:        'album' as const,
  year:        1997,
  mbid:        'mbid-123',
  source:      'manual' as const,
  coverUrl:    null,
  addedAt:     new Date().toISOString(),
  processedAt: null,
};

describe('WishlistController', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetConfig.mockReturnValue(AUTH_CONFIG as any);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('GET /api/v1/wishlist', () => {
    it('returns entries and total', async() => {
      mockService.getAll.mockResolvedValue([wishlistItem]);

      const res = await request(app)
        .get('/api/v1/wishlist')
        .set('Authorization', AUTH_HEADER);

      expect(res.status).toBe(200);
      expect(res.body.total).toBe(1);
      expect(res.body.entries).toHaveLength(1);
      expect(res.body.entries[0]).toMatchObject({
        id:     TEST_ID,
        artist: 'Radiohead',
        title:  'OK Computer',
        type:   'album',
        year:   1997,
      });
    });

    it('returns empty list', async() => {
      mockService.getAll.mockResolvedValue([]);

      const res = await request(app)
        .get('/api/v1/wishlist')
        .set('Authorization', AUTH_HEADER);

      expect(res.status).toBe(200);
      expect(res.body.entries).toEqual([]);
      expect(res.body.total).toBe(0);
    });

    it('returns 500 on service error', async() => {
      mockService.getAll.mockRejectedValue(new Error('DB failure'));

      const res = await request(app)
        .get('/api/v1/wishlist')
        .set('Authorization', AUTH_HEADER);

      expect(res.status).toBe(500);
      expect(res.body.error).toBe(true);
      expect(res.body.code).toBe('internal_error');
    });
  });

  describe('POST /api/v1/wishlist', () => {
    it('creates item and returns 201', async() => {
      mockService.append.mockResolvedValue(wishlistItem);

      const res = await request(app)
        .post('/api/v1/wishlist')
        .set('Authorization', AUTH_HEADER)
        .send({
          artist: 'Radiohead', title: 'OK Computer', type: 'album', year: 1997 
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.entry.artist).toBe('Radiohead');
      expect(res.body.entry.title).toBe('OK Computer');
      expect(mockService.append).toHaveBeenCalledWith(
        expect.objectContaining({
          artist: 'Radiohead',
          album:  'OK Computer',
          type:   'album',
          source: 'manual',
        }),
      );
    });

    it('returns 400 when artist is missing', async() => {
      const res = await request(app)
        .post('/api/v1/wishlist')
        .set('Authorization', AUTH_HEADER)
        .send({ title: 'OK Computer', type: 'album' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe(true);
      expect(res.body.code).toBe('validation_error');
    });

    it('returns 400 when title is missing for album type', async() => {
      const res = await request(app)
        .post('/api/v1/wishlist')
        .set('Authorization', AUTH_HEADER)
        .send({
          artist: 'Radiohead', title: '', type: 'album' 
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe(true);
      expect(res.body.code).toBe('validation_error');
    });
  });

  describe('GET /api/v1/wishlist/paginated', () => {
    it('returns paginated results with filters', async() => {
      mockService.getPaginatedWithStatus.mockResolvedValue({
        items:  [wishlistItem],
        total:  1,
        limit:  20,
        offset: 0,
      });

      const res = await request(app)
        .get('/api/v1/wishlist/paginated')
        .query({
          source: 'manual', limit: 20, offset: 0 
        })
        .set('Authorization', AUTH_HEADER);

      expect(res.status).toBe(200);
      expect(res.body.entries).toHaveLength(1);
      expect(res.body.total).toBe(1);
      expect(res.body.limit).toBe(20);
      expect(res.body.offset).toBe(0);
      expect(mockService.getPaginatedWithStatus).toHaveBeenCalledWith(
        expect.objectContaining({
          source: 'manual', limit: 20, offset: 0 
        }),
      );
    });

    it('returns 400 for invalid query params', async() => {
      const res = await request(app)
        .get('/api/v1/wishlist/paginated')
        .query({ limit: 999 })
        .set('Authorization', AUTH_HEADER);

      expect(res.status).toBe(400);
      expect(res.body.error).toBe(true);
      expect(res.body.code).toBe('validation_error');
    });
  });

  describe('DELETE /api/v1/wishlist/:id', () => {
    it('deletes item and returns success', async() => {
      mockService.removeById.mockResolvedValue(true);

      const res = await request(app)
        .delete(`/api/v1/wishlist/${ TEST_ID }`)
        .set('Authorization', AUTH_HEADER);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('Removed from wishlist');
      expect(mockService.removeById).toHaveBeenCalledWith(TEST_ID);
    });

    it('returns 404 when item not found', async() => {
      mockService.removeById.mockResolvedValue(false);

      const res = await request(app)
        .delete(`/api/v1/wishlist/${ TEST_ID }`)
        .set('Authorization', AUTH_HEADER);

      expect(res.status).toBe(404);
      expect(res.body.error).toBe(true);
      expect(res.body.code).toBe('not_found');
    });
  });

  describe('PUT /api/v1/wishlist/:id', () => {
    it('updates item and returns success', async() => {
      const updated = { ...wishlistItem, artist: 'Thom Yorke' };

      mockService.updateById.mockResolvedValue(updated);

      const res = await request(app)
        .put(`/api/v1/wishlist/${ TEST_ID }`)
        .set('Authorization', AUTH_HEADER)
        .send({ artist: 'Thom Yorke' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.entry.artist).toBe('Thom Yorke');
      expect(mockService.updateById).toHaveBeenCalledWith(
        TEST_ID,
        expect.objectContaining({ artist: 'Thom Yorke' }),
      );
    });

    it('returns 404 when item not found', async() => {
      mockService.updateById.mockResolvedValue(null);

      const res = await request(app)
        .put(`/api/v1/wishlist/${ TEST_ID }`)
        .set('Authorization', AUTH_HEADER)
        .send({ artist: 'Thom Yorke' });

      expect(res.status).toBe(404);
      expect(res.body.error).toBe(true);
      expect(res.body.code).toBe('not_found');
    });

    it('returns 400 for invalid body', async() => {
      const res = await request(app)
        .put(`/api/v1/wishlist/${ TEST_ID }`)
        .set('Authorization', AUTH_HEADER)
        .send({ artist: '' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe(true);
      expect(res.body.code).toBe('validation_error');
    });
  });

  describe('DELETE /api/v1/wishlist/bulk', () => {
    it('bulk deletes items and returns affected count', async() => {
      mockService.bulkDelete.mockResolvedValue(2);

      const res = await request(app)
        .delete('/api/v1/wishlist/bulk')
        .set('Authorization', AUTH_HEADER)
        .send({ ids: [TEST_ID, TEST_ID2] });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.affected).toBe(2);
      expect(mockService.bulkDelete).toHaveBeenCalledWith([TEST_ID, TEST_ID2]);
    });

    it('returns 400 for empty ids array', async() => {
      const res = await request(app)
        .delete('/api/v1/wishlist/bulk')
        .set('Authorization', AUTH_HEADER)
        .send({ ids: [] });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe(true);
      expect(res.body.code).toBe('validation_error');
    });
  });

  describe('POST /api/v1/wishlist/requeue', () => {
    it('bulk requeues items and returns affected count', async() => {
      mockService.bulkRequeue.mockResolvedValue(2);

      const res = await request(app)
        .post('/api/v1/wishlist/requeue')
        .set('Authorization', AUTH_HEADER)
        .send({ ids: [TEST_ID, TEST_ID2] });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.affected).toBe(2);
      expect(mockService.bulkRequeue).toHaveBeenCalledWith([TEST_ID, TEST_ID2]);
    });

    it('returns 400 for empty ids array', async() => {
      const res = await request(app)
        .post('/api/v1/wishlist/requeue')
        .set('Authorization', AUTH_HEADER)
        .send({ ids: [] });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe(true);
      expect(res.body.code).toBe('validation_error');
    });
  });

  describe('GET /api/v1/wishlist/export', () => {
    it('exports wishlist as JSON', async() => {
      const exportContent = JSON.stringify([{ artist: 'Radiohead', title: 'OK Computer' }]);

      mockService.exportItems.mockResolvedValue(exportContent);

      const res = await request(app)
        .get('/api/v1/wishlist/export')
        .query({ format: 'json' })
        .set('Authorization', AUTH_HEADER);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(/application\/json/);
      expect(res.headers['content-disposition']).toBe('attachment; filename="wishlist.json"');
      expect(mockService.exportItems).toHaveBeenCalledWith(
        expect.objectContaining({ format: 'json' }),
      );
    });

    it('returns 400 for invalid format', async() => {
      const res = await request(app)
        .get('/api/v1/wishlist/export')
        .query({ format: 'csv' })
        .set('Authorization', AUTH_HEADER);

      expect(res.status).toBe(400);
      expect(res.body.error).toBe(true);
      expect(res.body.code).toBe('validation_error');
    });
  });

  describe('POST /api/v1/wishlist/import', () => {
    it('imports items and returns 200', async() => {
      mockService.importItems.mockResolvedValue({
        added:   1,
        skipped: 0,
        errors:  0,
        results: [{
          artist: 'Radiohead', title: 'OK Computer', status: 'added' 
        }],
      });

      const res = await request(app)
        .post('/api/v1/wishlist/import')
        .set('Authorization', AUTH_HEADER)
        .send({
          items: [{
            artist: 'Radiohead', title: 'OK Computer', type: 'album' 
          }] 
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.added).toBe(1);
      expect(res.body.errors).toBe(0);
      expect(mockService.importItems).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            artist: 'Radiohead', title: 'OK Computer', type: 'album' 
          }),
        ]),
      );
    });

    it('returns 400 for empty items array', async() => {
      const res = await request(app)
        .post('/api/v1/wishlist/import')
        .set('Authorization', AUTH_HEADER)
        .send({ items: [] });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe(true);
      expect(res.body.code).toBe('validation_error');
    });
  });

  describe('Auth', () => {
    it('returns 401 without auth header', async() => {
      const res = await request(app)
        .get('/api/v1/wishlist');

      expect(res.status).toBe(401);
    });
  });
});
