import { Op } from '@sequelize/core';
import QueueItem, { QueueItemSource } from '@server/models/QueueItem';
import WishlistService from './WishlistService';
import logger from '@server/config/logger';

/**
 * QueueService manages the pending approval queue.
 * Provides operations for listing, approving, and rejecting recommendations.
 */
export class QueueService {
  private wishlistService: WishlistService;

  constructor() {
    this.wishlistService = new WishlistService();
  }

  /**
   * Get paginated pending items with filtering and sorting
   */
  async getPending(params: {
    source?: QueueItemSource | 'all';
    sort?:   'added_at' | 'score' | 'artist' | 'year';
    order?:  'asc' | 'desc';
    limit?:  number;
    offset?: number;
  }): Promise<{ items: QueueItem[]; total: number }> {
    const {
      source = 'all',
      sort = 'added_at',
      order = 'desc',
      limit = 50,
      offset = 0,
    } = params;

    // Build where clause
    const where: Record<string, unknown> = { status: 'pending' };

    if (source !== 'all') {
      where.source = source;
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
      artist: item.artist,
      album:  item.album,
      title:  item.title,
      type:   item.type,
    }));

    this.wishlistService.processApproved(wishlistItems);

    logger.info(`Approved ${ items.length } items`);

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

    const [affectedCount] = await QueueItem.update(
      {
        status:      'rejected',
        processedAt: new Date(),
      },
      {
        where: {
          mbid:   { [Op.in]: mbids },
          status: 'pending',
        },
      }
    );

    logger.info(`Rejected ${ affectedCount } items`);

    return affectedCount;
  }

  /**
   * Get queue statistics
   */
  async getStats(): Promise<{
    pending:  number;
    approved: number;
    rejected: number;
  }> {
    const [pending, approved, rejected] = await Promise.all([
      QueueItem.count({ where: { status: 'pending' } }),
      QueueItem.count({ where: { status: 'approved' } }),
      QueueItem.count({ where: { status: 'rejected' } }),
    ]);

    return {
      pending,
      approved,
      rejected,
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
  }): Promise<QueueItem> {
    const queueItem = await QueueItem.create({
      ...item,
      status:  'pending',
      addedAt: new Date(),
    });

    logger.info(`Added to pending queue: ${ item.artist } - ${ item.album || item.title }`);

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
