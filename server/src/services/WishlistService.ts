import type { CreateWishlistItemOptions, ProcessApprovedItem } from '@server/types/wishlist';

import logger from '@server/config/logger';
import WishlistItem, { WishlistItemSource, WishlistItemType } from '@server/models/WishlistItem';

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
    await WishlistItem.update(
      { processedAt: new Date() },
      { where: { id } }
    );
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

    // Check for existing item with same artist/album/type
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
      source:   source ?? 'manual',
      coverUrl,
      addedAt:  new Date(),
    });

    logger.info(`Added to wishlist: ${ artist } - ${ album }`);

    return wishlistItem;
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

      // Check for existing item
      const existing = await this.findByArtistAlbum(artist, album, type);

      if (existing) {
        logger.debug(`Wishlist item already exists: ${ artist } - ${ album }`);
        continue;
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

      count++;
      logger.info(`Added to wishlist: ${ artist } - ${ album }`);
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
    const deleted = await WishlistItem.destroy({
      where: {
        artist,
        album,
      },
    });

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

    await item.destroy();
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
}

export default WishlistService;
