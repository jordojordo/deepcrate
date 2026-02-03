import type {
  CreateWishlistItemOptions,
  ProcessApprovedItem,
  WishlistFilters,
  WishlistEntryWithStatus,
  UpdateWishlistItemRequest,
  ExportFormat,
  ImportItem,
  ImportResultItem,
} from '@server/types/wishlist';

import { Op } from '@sequelize/core';
import logger from '@server/config/logger';
import { withDbWrite } from '@server/config/db';
import WishlistItem, { WishlistItemSource, WishlistItemType } from '@server/models/WishlistItem';
import DownloadTask from '@server/models/DownloadTask';

/**
 * WishlistService manages wishlist items in the database.
 * Replaces the file-based wishlist.txt approach.
 */
export class WishlistService {
  /**
   * Get all wishlist items
   */
  async getAll(): Promise<WishlistItem[]> {
    return WishlistItem.findAll({ order: [['addedAt', 'DESC']] });
  }

  /**
   * Get paginated wishlist items
   */
  async getPaginated(params: {
    limit?:  number;
    offset?: number;
  }): Promise<{ items: WishlistItem[]; total: number }> {
    const { limit = 50, offset = 0 } = params;

    const { rows, count } = await WishlistItem.findAndCountAll({
      order: [['addedAt', 'DESC']],
      limit,
      offset,
    });

    return {
      items: rows,
      total: count,
    };
  }

  /**
   * Find a wishlist item by ID
   */
  async findById(id: string): Promise<WishlistItem | null> {
    return WishlistItem.findByPk(id);
  }

  /**
   * Find a wishlist item by artist, album, and type
   */
  async findByArtistAlbum(artist: string, album: string, type: WishlistItemType = 'album'): Promise<WishlistItem | null> {
    return WishlistItem.findOne({
      where: {
        artist,
        album,
        type,
      },
    });
  }

  /**
   * Get unprocessed wishlist items (items awaiting download)
   */
  async getUnprocessed(): Promise<WishlistItem[]> {
    return WishlistItem.findAll({
      where:  { processedAt: null },
      order: [['addedAt', 'ASC']],
    });
  }

  /**
   * Mark a wishlist item as processed (download task created)
   */
  async markProcessed(id: string): Promise<void> {
    await withDbWrite(() => WishlistItem.update(
      { processedAt: new Date() },
      { where: { id } }
    ));
    logger.debug(`Marked wishlist item ${ id } as processed`);
  }

  /**
   * Append a single entry to the wishlist.
   * Returns the created or existing WishlistItem.
   */
  async append(options: CreateWishlistItemOptions): Promise<WishlistItem> {
    const {
      artist, album, type, year, mbid, source, coverUrl
    } = options;

    return withDbWrite(async() => {
      // Check inside mutex to prevent race between read and write
      const existing = await this.findByArtistAlbum(artist, album, type);

      if (existing) {
        logger.debug(`Wishlist item already exists: ${ artist } - ${ album }`);

        return existing;
      }

      const wishlistItem = await WishlistItem.create({
        artist,
        album,
        type,
        year,
        mbid,
        source:  source ?? 'manual',
        coverUrl,
        addedAt: new Date(),
      });

      logger.info(`Added to wishlist: ${ artist } - ${ album }`);

      return wishlistItem;
    });
  }

  /**
   * Process approved queue items and add them to wishlist.
   * Returns the number of items added.
   */
  async processApproved(items: ProcessApprovedItem[]): Promise<number> {
    if (!items.length) {
      return 0;
    }

    let count = 0;

    for (const item of items) {
      const artist = item.artist;

      // Determine album/title and type
      let album: string;
      let isAlbum: boolean;

      if (item.album) {
        album = item.album;
        isAlbum = true;
      } else if (item.title) {
        album = item.title;
        isAlbum = item.type === 'album';
      } else {
        logger.warn(`Skipping item with missing album/title: ${ JSON.stringify(item) }`);
        continue;
      }

      if (!artist || !album) {
        logger.warn(`Skipping item with missing artist or title: ${ JSON.stringify(item) }`);
        continue;
      }

      const type: WishlistItemType = isAlbum ? 'album' : 'track';

      // Check and create inside mutex to prevent race between read and write
      const added = await withDbWrite(async() => {
        const existing = await this.findByArtistAlbum(artist, album, type);

        if (existing) {
          logger.debug(`Wishlist item already exists: ${ artist } - ${ album }`);

          return false;
        }

        await WishlistItem.create({
          artist,
          album,
          type,
          year:     item.year,
          mbid:     item.mbid,
          source:   (item.source as WishlistItemSource) ?? 'manual',
          coverUrl: item.coverUrl,
          addedAt:  new Date(),
        });

        return true;
      });

      if (added) {
        count++;
        logger.info(`Added to wishlist: ${ artist } - ${ album }`);
      }
    }

    return count;
  }

  /**
   * Read all wishlist entries (for backward compatibility).
   * Returns entries in the format expected by existing consumers.
   */
  async readAll(): Promise<Array<{ artist: string; title: string; type: 'artist' | 'album' | 'track' }>> {
    const items = await WishlistItem.findAll({ order: [['addedAt', 'ASC']] });

    return items.map(item => ({
      artist: item.artist,
      title:  item.album,
      type:   item.type,
    }));
  }

  /**
   * Remove an entry from the wishlist by artist and album.
   * Returns true if entry was found and removed.
   */
  async remove(artist: string, album: string): Promise<boolean> {
    const deleted = await withDbWrite(() => WishlistItem.destroy({
      where: {
        artist,
        album,
      },
    }));

    if (deleted > 0) {
      logger.info(`Removed from wishlist: ${ artist } - ${ album }`);

      return true;
    }

    return false;
  }

  /**
   * Remove a wishlist item by ID.
   * @returns true if entry was found and removed
   */
  async removeById(id: string): Promise<boolean> {
    const item = await WishlistItem.findByPk(id);

    if (!item) {
      return false;
    }

    await withDbWrite(() => item.destroy());
    logger.info(`Removed from wishlist: ${ item.artist } - ${ item.album }`);

    return true;
  }

  /**
   * Build a wishlist key from artist and album (for backward compatibility).
   * Format: "Artist - Album"
   */
  buildWishlistKey(artist: string, album: string): string {
    return `${ artist } - ${ album }`;
  }

  /**
   * Get paginated wishlist items with download status from DownloadTask
   */
  async getPaginatedWithStatus(filters: WishlistFilters): Promise<{
    items:  WishlistEntryWithStatus[];
    total:  number;
    limit:  number;
    offset: number;
  }> {
    const {
      source,
      type,
      processed,
      dateFrom,
      dateTo,
      search,
      sort = 'addedAt_desc',
      limit = 50,
      offset = 0,
    } = filters;

    const where: Record<string, unknown> = {
      ...(source && { source }),
      ...(type && { type }),
      ...(processed === 'pending' && { processedAt: null }),
      ...(processed === 'processed' && { processedAt: { [Op.ne]: null } }),
      ...((dateFrom || dateTo) && {
        addedAt: {
          ...(dateFrom && { [Op.gte]: new Date(dateFrom) }),
          ...(dateTo && { [Op.lte]: new Date(dateTo) }),
        },
      }),
      ...(search && {
        [Op.or]: [
          { artist: { [Op.like]: `%${ search }%` } },
          { album: { [Op.like]: `%${ search }%` } },
        ],
      }),
    };

    // Parse sort
    const [sortField, sortDir] = sort.split('_') as [string, 'asc' | 'desc'];
    const fieldMap: Record<string, string> = {
      addedAt:     'addedAt',
      artist:      'artist',
      title:       'album',
      processedAt: 'processedAt',
    };
    const orderField = fieldMap[sortField] || 'addedAt';
    const order: [string, string][] = [[orderField, sortDir.toUpperCase()]];

    // Fetch wishlist items
    const { rows, count } = await WishlistItem.findAndCountAll({
      where,
      order,
      limit,
      offset,
    });

    // Fetch download tasks for these items to get status
    const itemIds = rows.map((r) => r.id);
    let downloadTasks: DownloadTask[] = [];

    if (itemIds.length > 0) {
      downloadTasks = await DownloadTask.findAll({ where: { wishlistItemId: { [Op.in]: itemIds } } });
    }

    // Create a map of wishlistItemId -> DownloadTask
    const taskMap = new Map<string, DownloadTask>();

    for (const task of downloadTasks) {
      if (task.wishlistItemId) {
        taskMap.set(task.wishlistItemId, task);
      }
    }

    // Map to response format with status
    const items: WishlistEntryWithStatus[] = rows.map((item) => {
      const task = taskMap.get(item.id);
      let downloadStatus: WishlistEntryWithStatus['downloadStatus'] = 'none';

      if (task) {
        downloadStatus = task.status;
      } else if (item.processedAt) {
        // Has processedAt but no task found - could be old data
        downloadStatus = 'pending';
      }

      return {
        id:             item.id,
        artist:         item.artist,
        title:          item.album,
        type:           item.type,
        year:           item.year ?? null,
        mbid:           item.mbid ?? null,
        source:         item.source ?? null,
        coverUrl:       item.coverUrl ?? null,
        addedAt:        item.addedAt,
        processedAt:    item.processedAt ?? null,
        downloadStatus,
        downloadTaskId: task?.id ?? null,
        downloadError:  task?.errorMessage ?? null,
      };
    });

    return {
      items,
      total: count,
      limit,
      offset,
    };
  }

  /**
   * Update a wishlist item by ID
   * If resetDownloadState is true, clears processedAt to re-queue for download
   */
  async updateById(
    id: string,
    updates: UpdateWishlistItemRequest
  ): Promise<WishlistItem | null> {
    return withDbWrite(async() => {
      const item = await WishlistItem.findByPk(id);

      if (!item) {
        return null;
      }

      // Build update object
      const updateData: Partial<WishlistItem> = {
        ...(updates.artist !== undefined && { artist: updates.artist }),
        ...(updates.title !== undefined && { album: updates.title }),
        ...(updates.type !== undefined && { type: updates.type as WishlistItemType }),
        ...(updates.year !== undefined && { year: updates.year }),
        ...(updates.mbid !== undefined && { mbid: updates.mbid }),
        ...(updates.source !== undefined && { source: updates.source as WishlistItemSource | null }),
        ...(updates.coverUrl !== undefined && { coverUrl: updates.coverUrl }),
        ...(updates.resetDownloadState && { processedAt: null }),
      };

      if (updates.resetDownloadState) {
        logger.info(`Resetting download state for wishlist item ${ id }`);
      }

      await item.update(updateData);
      logger.info(`Updated wishlist item ${ id }: ${ item.artist } - ${ item.album }`);

      return item;
    });
  }

  /**
   * Bulk delete wishlist items by IDs
   */
  async bulkDelete(ids: string[]): Promise<number> {
    if (!ids.length) {
      return 0;
    }

    const deleted = await withDbWrite(() => WishlistItem.destroy({ where: { id: { [Op.in]: ids } } }));

    logger.info(`Bulk deleted ${ deleted } wishlist items`);

    return deleted;
  }

  /**
   * Bulk requeue wishlist items for download by resetting processedAt
   */
  async bulkRequeue(ids: string[]): Promise<number> {
    if (!ids.length) {
      return 0;
    }

    const [affected] = await withDbWrite(() => WishlistItem.update(
      { processedAt: null },
      { where: { id: { [Op.in]: ids } } }
    ));

    logger.info(`Bulk requeued ${ affected } wishlist items for download`);

    return affected;
  }

  /**
   * Export wishlist items to JSON string
   */
  async exportItems(params: {
    format: ExportFormat;
    ids?:   string[];
  }): Promise<string> {
    const { ids } = params;

    const where = ids?.length ? { id: { [Op.in]: ids } } : {};
    const items = await WishlistItem.findAll({
      where,
      order: [['addedAt', 'DESC']],
    });

    const exportData = items.map((item) => ({
      artist:   item.artist,
      title:    item.album,
      type:     item.type,
      year:     item.year ?? null,
      mbid:     item.mbid ?? null,
      source:   item.source ?? null,
      coverUrl: item.coverUrl ?? null,
      addedAt:  item.addedAt.toISOString(),
    }));

    return JSON.stringify(exportData, null, 2);
  }

  /**
   * Import items from array with duplicate checking
   */
  async importItems(items: ImportItem[]): Promise<{
    added:   number;
    skipped: number;
    errors:  number;
    results: ImportResultItem[];
  }> {
    const results: ImportResultItem[] = [];
    let added = 0;
    let skipped = 0;
    let errors = 0;

    for (const item of items) {
      try {
        const artist = item.artist;
        const album = item.title || '';
        const type = item.type as WishlistItemType;

        // Check inside mutex for each item
        const result = await withDbWrite(async() => {
          const existing = await this.findByArtistAlbum(artist, album, type);

          if (existing) {
            return { status: 'skipped' as const, message: 'Already exists' };
          }

          await WishlistItem.create({
            artist,
            album,
            type,
            year:     item.year ?? undefined,
            mbid:     item.mbid ?? undefined,
            source:   (item.source as WishlistItemSource) ?? 'manual',
            coverUrl: item.coverUrl ?? undefined,
            addedAt:  new Date(),
          });

          return { status: 'added' as const };
        });

        results.push({
          artist: item.artist,
          title:  item.title || '',
          status: result.status,
          ...(result.message && { message: result.message }),
        });

        if (result.status === 'added') {
          added++;
        } else {
          skipped++;
        }
      } catch(error) {
        errors++;
        results.push({
          artist:  item.artist,
          title:   item.title || '',
          status:  'error',
          message: (error as Error).message,
        });
      }
    }

    logger.info(`Import complete: ${ added } added, ${ skipped } skipped, ${ errors } errors`);

    return {
      added,
      skipped,
      errors,
      results,
    };
  }
}

export default WishlistService;
