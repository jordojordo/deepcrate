import { Op } from '@sequelize/core';
import QueueItem, { QueueItemSource } from '@server/models/QueueItem';
import WishlistService from './WishlistService';
import LibraryService from './LibraryService';
import { getConfig } from '@server/config/settings';
import logger from '@server/config/logger';
import {
  emitQueueItemAdded,
  emitQueueItemUpdated,
  emitQueueStatsUpdated,
} from '@server/plugins/io/namespaces/queueNamespace';

/**
 * QueueService manages the pending approval queue.
 * Provides operations for listing, approving, and rejecting recommendations.
 */
export class QueueService {
  private wishlistService: WishlistService;
  private libraryService:  LibraryService;

  constructor() {
    this.wishlistService = new WishlistService();
    this.libraryService = new LibraryService();
  }

  /**
   * Get paginated pending items with filtering and sorting
   */
  async getPending(params: {
    source?:        QueueItemSource | 'all';
    sort?:          'added_at' | 'score' | 'artist' | 'year';
    order?:         'asc' | 'desc';
    limit?:         number;
    offset?:        number;
    hideInLibrary?: boolean;
  }): Promise<{ items: QueueItem[]; total: number }> {
    const {
      source = 'all',
      sort = 'added_at',
      order = 'desc',
      limit = 50,
      offset = 0,
      hideInLibrary = false,
    } = params;

    // Build where clause
    const where: Record<string, unknown> = { status: 'pending' };

    if (source !== 'all') {
      where.source = source;
    }

    // Filter out items already in library if requested
    if (hideInLibrary) {
      where.inLibrary = { [Op.or]: [{ [Op.eq]: false }, { [Op.eq]: null }] };
    }

    // Map sort field to column name
    const sortField = sort === 'added_at' ? 'addedAt' : sort;

    // Query database
    const { rows, count } = await QueueItem.findAndCountAll({
      where,
      order: [[sortField, order.toUpperCase()]],
      limit,
      offset,
    });

    return {
      items: rows,
      total: count,
    };
  }

  /**
   * Approve items by MBID and move to wishlist
   */
  async approve(mbids: string[]): Promise<number> {
    if (!mbids.length) {
      return 0;
    }

    // Find items to approve
    const items = await QueueItem.findAll({
      where: {
        mbid:   { [Op.in]: mbids },
        status: 'pending',
      },
    });

    if (!items.length) {
      return 0;
    }

    // Update status to approved
    await QueueItem.update(
      {
        status:      'approved',
        processedAt: new Date(),
      },
      {
        where: {
          mbid:   { [Op.in]: mbids },
          status: 'pending',
        },
      }
    );

    // Add to wishlist
    const wishlistItems = items.map(item => ({
      artist:   item.artist,
      album:    item.album,
      title:    item.title,
      type:     item.type,
      year:     item.year,
      mbid:     item.mbid,
      source:   item.source,
      coverUrl: item.coverUrl,
    }));

    await this.wishlistService.processApproved(wishlistItems);

    logger.info(`Approved ${ items.length } items`);

    // Emit socket events for each approved item
    const processedAt = new Date();

    for (const item of items) {
      emitQueueItemUpdated({
        mbid:   item.mbid,
        status: 'approved',
        processedAt,
      });
    }

    // Emit stats update
    const stats = await this.getStats();

    emitQueueStatsUpdated(stats);

    return items.length;
  }

  /**
   * Approve all pending items
   */
  async approveAll(): Promise<number> {
    const pendingItems = await QueueItem.findAll({ where: { status: 'pending' } });

    if (!pendingItems.length) {
      return 0;
    }

    const mbids = pendingItems.map(item => item.mbid);

    return this.approve(mbids);
  }

  /**
   * Reject items by MBID
   */
  async reject(mbids: string[]): Promise<number> {
    if (!mbids.length) {
      return 0;
    }

    const processedAt = new Date();

    const [affectedCount] = await QueueItem.update(
      {
        status: 'rejected',
        processedAt,
      },
      {
        where: {
          mbid:   { [Op.in]: mbids },
          status: 'pending',
        },
      }
    );

    logger.info(`Rejected ${ affectedCount } items`);

    // Emit socket events for each rejected item
    for (const mbid of mbids) {
      emitQueueItemUpdated({
        mbid,
        status: 'rejected',
        processedAt,
      });
    }

    // Emit stats update
    const stats = await this.getStats();

    emitQueueStatsUpdated(stats);

    return affectedCount;
  }

  /**
   * Get queue statistics
   */
  async getStats(): Promise<{
    pending:   number;
    approved:  number;
    rejected:  number;
    inLibrary: number;
  }> {
    const [pending, approved, rejected, inLibrary] = await Promise.all([
      QueueItem.count({ where: { status: 'pending' } }),
      QueueItem.count({ where: { status: 'approved' } }),
      QueueItem.count({ where: { status: 'rejected' } }),
      QueueItem.count({ where: { status: 'pending', inLibrary: true } }),
    ]);

    return {
      pending,
      approved,
      rejected,
      inLibrary,
    };
  }

  /**
   * Add a new item to the pending queue
   */
  async addPending(item: {
    artist:       string;
    album?:       string;
    title?:       string;
    mbid:         string;
    type:         'album' | 'track';
    score?:       number;
    source:       QueueItemSource;
    similarTo?:   string[];
    sourceTrack?: string;
    coverUrl?:    string;
    year?:        number;
    inLibrary?:   boolean;
  }): Promise<QueueItem> {
    const config = getConfig();
    const libraryDuplicateEnabled = config.library_duplicate?.enabled ?? false;
    const autoReject = config.library_duplicate?.auto_reject ?? false;

    // Check library if not already provided and feature is enabled
    let inLibrary = item.inLibrary;

    if (inLibrary === undefined && libraryDuplicateEnabled && item.album) {
      inLibrary = await this.libraryService.isInLibrary(item.artist, item.album);
    }

    // Auto-reject if configured and item is in library
    if (autoReject && inLibrary) {
      const queueItem = await QueueItem.create({
        ...item,
        inLibrary,
        status:      'rejected',
        addedAt:     new Date(),
        processedAt: new Date(),
      });

      logger.info(`Auto-rejected duplicate: ${ item.artist } - ${ item.album || item.title }`);

      return queueItem;
    }

    const queueItem = await QueueItem.create({
      ...item,
      inLibrary: inLibrary ?? false,
      status:    'pending',
      addedAt:   new Date(),
    });

    logger.info(`Added to pending queue: ${ item.artist } - ${ item.album || item.title }${ inLibrary ? ' (in library)' : '' }`);

    // Emit socket events
    emitQueueItemAdded({ item: queueItem });

    const stats = await this.getStats();

    emitQueueStatsUpdated(stats);

    return queueItem;
  }

  /**
   * Check if an MBID has been rejected
   */
  async isRejected(mbid: string): Promise<boolean> {
    const item = await QueueItem.findOne({
      where: {
        mbid,
        status: 'rejected',
      },
    });

    return item !== null;
  }

  /**
   * Check if an MBID is already in the pending queue
   */
  async isPending(mbid: string): Promise<boolean> {
    const item = await QueueItem.findOne({
      where: {
        mbid,
        status: 'pending',
      },
    });

    return item !== null;
  }
}

export default QueueService;
