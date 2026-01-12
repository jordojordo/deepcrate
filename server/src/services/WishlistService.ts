import fs from 'fs';
import path from 'path';
import { getDataPath } from '@server/config/settings';
import logger from '@server/config/logger';

/**
 * WishlistService manages the wishlist.txt file.
 * This file is read directly by slskd for downloads.
 *
 * Format:
 * - Albums: a:"Artist - Album"
 * - Tracks: "Artist - Track"
 */
export class WishlistService {
  private wishlistPath: string;

  constructor() {
    this.wishlistPath = path.join(getDataPath(), 'wishlist.txt');
    this.ensureWishlistExists();
  }

  /**
   * Ensure wishlist.txt exists
   */
  private ensureWishlistExists(): void {
    const dataPath = getDataPath();

    if (!fs.existsSync(dataPath)) {
      fs.mkdirSync(dataPath, { recursive: true });
    }

    if (!fs.existsSync(this.wishlistPath)) {
      fs.writeFileSync(this.wishlistPath, '', 'utf-8');
    }
  }

  /**
   * Escape double quotes in text for wishlist format
   */
  private escapeQuotes(text: string): string {
    return text.replace(/"/g, '\\"');
  }

  /**
   * Append a single entry to the wishlist
   */
  append(artist: string, title: string, isAlbum: boolean = true): void {
    const artistEscaped = this.escapeQuotes(artist);
    const titleEscaped = this.escapeQuotes(title);

    const prefix = isAlbum ? 'a:' : '';
    const line = `${ prefix }"${ artistEscaped } - ${ titleEscaped }"\n`;

    fs.appendFileSync(this.wishlistPath, line, 'utf-8');
    logger.info(`Added to wishlist: ${ artist } - ${ title }`);
  }

  /**
   * Process approved queue items and add them to wishlist
   */
  processApproved(items: Array<{ artist: string; album?: string; title?: string; type?: string }>): number {
    if (!items.length) {
      return 0;
    }

    let count = 0;
    const lines: string[] = [];

    for (const item of items) {
      const artist = item.artist;

      // Determine if album or track
      let title: string;
      let isAlbum: boolean;

      if (item.album) {
        title = item.album;
        isAlbum = true;
      } else if (item.title) {
        title = item.title;
        isAlbum = item.type === 'album';
      } else {
        logger.warn(`Skipping item with missing album/title: ${ JSON.stringify(item) }`);
        continue;
      }

      if (!artist || !title) {
        logger.warn(`Skipping item with missing artist or title: ${ JSON.stringify(item) }`);
        continue;
      }

      const artistEscaped = this.escapeQuotes(artist);
      const titleEscaped = this.escapeQuotes(title);

      const prefix = isAlbum ? 'a:' : '';
      const line = `${ prefix }"${ artistEscaped } - ${ titleEscaped }"\n`;

      lines.push(line);
      count++;
      logger.info(`Added to wishlist: ${ artist } - ${ title }`);
    }

    if (lines.length > 0) {
      fs.appendFileSync(this.wishlistPath, lines.join(''), 'utf-8');
    }

    return count;
  }

  /**
   * Read all wishlist entries
   */
  readAll(): string[] {
    if (!fs.existsSync(this.wishlistPath)) {
      return [];
    }

    const content = fs.readFileSync(this.wishlistPath, 'utf-8');

    return content.split('\n').filter(line => line.trim().length > 0);
  }
}

export default WishlistService;
