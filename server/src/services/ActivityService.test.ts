import {
  describe, it, expect, vi, beforeEach,
} from 'vitest';

const { mockQueueFindAndCountAll, mockDownloadFindAndCountAll } = vi.hoisted(() => ({
  mockQueueFindAndCountAll:    vi.fn(),
  mockDownloadFindAndCountAll: vi.fn(),
}));

vi.mock('@server/models/QueueItem', () => ({ default: { findAndCountAll: mockQueueFindAndCountAll } }));

vi.mock('@server/models/DownloadTask', () => ({ default: { findAndCountAll: mockDownloadFindAndCountAll } }));

import { ActivityService } from '@server/services/ActivityService';

function makeQueueItem(overrides: Record<string, unknown> = {}) {
  return {
    id:          1,
    artist:      'Test Artist',
    album:       'Test Album',
    title:       null,
    mbid:        'aaaa-bbbb',
    status:      'approved',
    coverUrl:    'https://example.com/cover.jpg',
    addedAt:     new Date('2025-01-15T10:00:00Z'),
    processedAt: new Date('2025-01-15T12:00:00Z'),
    ...overrides,
  };
}

function makeDownloadTask(overrides: Record<string, unknown> = {}) {
  return {
    id:          'dl-uuid-1',
    artist:      'DL Artist',
    album:       'DL Album',
    status:      'completed',
    queuedAt:    new Date('2025-01-14T10:00:00Z'),
    completedAt: new Date('2025-01-15T14:00:00Z'),
    ...overrides,
  };
}

describe('ActivityService', () => {
  let service: ActivityService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new ActivityService();
  });

  it('returns merged and sorted activity items with total', async() => {
    mockQueueFindAndCountAll.mockResolvedValue({ rows: [makeQueueItem()], count: 1 });
    mockDownloadFindAndCountAll.mockResolvedValue({ rows: [makeDownloadTask()], count: 1 });

    const result = await service.getRecent({ limit: 10, offset: 0 });

    expect(result.items).toHaveLength(2);
    expect(result.total).toBe(2);
    // Download (14:00) should come before queue approved (12:00)
    expect(result.items[0].id).toBe('download-dl-uuid-1');
    expect(result.items[0].type).toBe('downloaded');
    expect(result.items[1].id).toBe('queue-1');
    expect(result.items[1].type).toBe('approved');
  });

  it('maps pending queue items as queued type', async() => {
    mockQueueFindAndCountAll.mockResolvedValue({ rows: [makeQueueItem({ status: 'pending', processedAt: null })], count: 1 });
    mockDownloadFindAndCountAll.mockResolvedValue({ rows: [], count: 0 });

    const result = await service.getRecent({ limit: 10, offset: 0 });

    expect(result.items).toHaveLength(1);
    expect(result.items[0].type).toBe('queued');
    expect(result.items[0].description).toBe('Queued for approval');
  });

  it('maps rejected queue items as rejected type', async() => {
    mockQueueFindAndCountAll.mockResolvedValue({ rows: [makeQueueItem({ status: 'rejected' })], count: 1 });
    mockDownloadFindAndCountAll.mockResolvedValue({ rows: [], count: 0 });

    const result = await service.getRecent({ limit: 10, offset: 0 });

    expect(result.items).toHaveLength(1);
    expect(result.items[0].type).toBe('rejected');
    expect(result.items[0].description).toBe('Rejected');
  });

  it('respects limit parameter', async() => {
    mockQueueFindAndCountAll.mockResolvedValue({
      rows: [
        makeQueueItem({ id: 1, processedAt: new Date('2025-01-15T12:00:00Z') }),
        makeQueueItem({ id: 2, processedAt: new Date('2025-01-15T11:00:00Z') }),
      ],
      count: 2,
    });
    mockDownloadFindAndCountAll.mockResolvedValue({ rows: [makeDownloadTask()], count: 1 });

    const result = await service.getRecent({ limit: 2, offset: 0 });

    expect(result.items).toHaveLength(2);
    expect(result.total).toBe(3);
  });

  it('applies offset to slice results', async() => {
    mockQueueFindAndCountAll.mockResolvedValue({
      rows: [
        makeQueueItem({ id: 1, processedAt: new Date('2025-01-15T12:00:00Z') }),
        makeQueueItem({ id: 2, processedAt: new Date('2025-01-15T11:00:00Z') }),
      ],
      count: 2,
    });
    mockDownloadFindAndCountAll.mockResolvedValue({ rows: [makeDownloadTask()], count: 1 });

    const result = await service.getRecent({ limit: 2, offset: 1 });

    expect(result.items).toHaveLength(2);
    expect(result.total).toBe(3);
    // Skips the first item (download at 14:00), returns queue items
    expect(result.items[0].id).toBe('queue-1');
    expect(result.items[1].id).toBe('queue-2');
  });

  it('includes coverUrl from queue items', async() => {
    mockQueueFindAndCountAll.mockResolvedValue({ rows: [makeQueueItem({ coverUrl: 'https://example.com/art.jpg' })], count: 1 });
    mockDownloadFindAndCountAll.mockResolvedValue({ rows: [], count: 0 });

    const result = await service.getRecent({ limit: 10, offset: 0 });

    expect(result.items[0].coverUrl).toBe('https://example.com/art.jpg');
  });

  it('handles empty results', async() => {
    mockQueueFindAndCountAll.mockResolvedValue({ rows: [], count: 0 });
    mockDownloadFindAndCountAll.mockResolvedValue({ rows: [], count: 0 });

    const result = await service.getRecent({ limit: 10, offset: 0 });

    expect(result.items).toHaveLength(0);
    expect(result.total).toBe(0);
  });
});
