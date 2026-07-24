import {
  describe, it, expect, vi, beforeEach,
} from 'vitest';
import { Op } from '@sequelize/core';

const {
  mockWishlistFindAll,
  mockWishlistDestroy,
  mockLibraryFindAll,
  mockGetConfig,
  mockFireEvent,
} = vi.hoisted(() => ({
  mockWishlistFindAll: vi.fn(),
  mockWishlistDestroy: vi.fn(),
  mockLibraryFindAll:  vi.fn(),
  mockGetConfig:       vi.fn(),
  mockFireEvent:       vi.fn(),
}));

vi.mock('@server/models/WishlistItem', () => ({ default: { findAll: mockWishlistFindAll, destroy: mockWishlistDestroy } }));
vi.mock('@server/models/LibraryAlbum', () => ({ default: { findAll: mockLibraryFindAll } }));
vi.mock('@server/models/QueueItem', () => ({ default: { findAll: vi.fn() } }));
vi.mock('@server/config/settings', () => ({ getConfig: mockGetConfig }));
vi.mock('@server/config/logger', () => ({
  default: {
    info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(),
  },
}));
vi.mock('@server/config/db', () => ({ withDbWrite: (fn: () => unknown) => fn() }));
vi.mock('@server/services/WebhookService', () => ({ fireEvent: mockFireEvent }));

import { LibraryService } from '@server/services/LibraryService';

function makeWishlistItem(overrides: Record<string, unknown> = {}) {
  return {
    id:     'wl-1',
    artist: 'Artist A',
    album:  'Album A',
    mbid:   'mbid-a',
    ...overrides,
  };
}

// LibraryAlbum rows are matched by lowercase artist/name in checkBatch.
function makeLibraryRow(artistLower: string, nameLower: string) {
  return { artistLower, nameLower };
}

describe('LibraryService.recheckWishlistItems', () => {
  let service: LibraryService;

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetConfig.mockReturnValue({ library_duplicate: { enabled: true, remove_wishlist_duplicates: true } });
    service = new LibraryService();
  });

  it('removes wishlist items found in the library and fires a webhook per removal', async() => {
    const inLibrary = makeWishlistItem({
      id: 'wl-1', artist: 'Artist A', album: 'Album A'
    });
    const notInLibrary = makeWishlistItem({
      id: 'wl-2', artist: 'Artist B', album: 'Album B', mbid: 'mbid-b',
    });

    mockWishlistFindAll.mockResolvedValue([inLibrary, notInLibrary]);
    // Only "Artist A / Album A" exists in the library.
    mockLibraryFindAll.mockResolvedValue([makeLibraryRow('artist a', 'album a')]);

    const removed = await service.recheckWishlistItems();

    expect(removed).toHaveLength(1);
    expect(removed?.[0].id).toBe('wl-1');
    expect(mockWishlistDestroy).toHaveBeenCalledWith({ where: { id: { [Op.in]: ['wl-1'] } } });
    expect(mockFireEvent).toHaveBeenCalledTimes(1);
    expect(mockFireEvent).toHaveBeenCalledWith('wishlist_removed', {
      artist: 'Artist A',
      album:  'Album A',
      mbid:   'mbid-a',
    });
  });

  it('does nothing when remove_wishlist_duplicates is disabled', async() => {
    mockGetConfig.mockReturnValue({ library_duplicate: { enabled: true, remove_wishlist_duplicates: false } });

    const removed = await service.recheckWishlistItems();

    expect(removed).toBeUndefined();
    expect(mockWishlistFindAll).not.toHaveBeenCalled();
    expect(mockWishlistDestroy).not.toHaveBeenCalled();
    expect(mockFireEvent).not.toHaveBeenCalled();
  });

  it('removes nothing when no wishlist items match the library', async() => {
    mockWishlistFindAll.mockResolvedValue([makeWishlistItem()]);
    mockLibraryFindAll.mockResolvedValue([]);

    const removed = await service.recheckWishlistItems();

    expect(removed).toBeUndefined();
    expect(mockWishlistDestroy).not.toHaveBeenCalled();
    expect(mockFireEvent).not.toHaveBeenCalled();
  });

  it('ignores wishlist items with an empty album', async() => {
    mockWishlistFindAll.mockResolvedValue([makeWishlistItem({ album: '   ' })]);

    const removed = await service.recheckWishlistItems();

    expect(removed).toBeUndefined();
    expect(mockLibraryFindAll).not.toHaveBeenCalled();
    expect(mockWishlistDestroy).not.toHaveBeenCalled();
  });
});
