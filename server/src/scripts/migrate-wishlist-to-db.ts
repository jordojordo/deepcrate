import fs from 'fs';
import path from 'path';

import logger from '@server/config/logger';
import { getDataPath } from '@server/config/settings';
import QueueItem from '@server/models/QueueItem';
import DownloadedItem from '@server/models/DownloadedItem';
import DownloadTask from '@server/models/DownloadTask';
import WishlistItem from '@server/models/WishlistItem';

/**
 * Parse a wishlist.txt line into structured data.
 * Format: a:"Artist - Album" for albums, "Artist - Title" for tracks
 */
function parseWishlistLine(line: string): { artist: string; album: string; type: 'album' | 'track' } | null {
  const trimmed = line.trim();

  if (!trimmed) {
    return null;
  }

  const isAlbum = trimmed.startsWith('a:');
  const content = isAlbum ? trimmed.slice(2) : trimmed;

  // Parse format: "Artist - Title"
  const match = content.match(/^"(.+) - (.+)"$/);

  if (!match) {
    return null;
  }

  const [, artist, album] = match;

  return {
    artist: artist.replace(/\\"/g, '"'),
    album:  album.replace(/\\"/g, '"'),
    type:   isAlbum ? 'album' : 'track',
  };
}

/**
 * Build wishlist key from artist and album/title (matches existing format)
 */
function buildWishlistKey(artist: string, album: string): string {
  return `${ artist } - ${ album }`;
}

/**
 * Migrate wishlist.txt to WishlistItem database table.
 *
 * This migration:
 * 1. Parses wishlist.txt entries
 * 2. Looks up metadata from QueueItem (year, mbid, source, coverUrl)
 * 3. Creates WishlistItem records
 * 4. Imports DownloadedItem records (sets processedAt on WishlistItem)
 * 5. Links existing DownloadTask records via wishlistItemId FK
 * 6. Backs up wishlist.txt to wishlist.txt.bak
 */
export async function migrateWishlistToDb(): Promise<void> {
  const dataPath = getDataPath();
  const wishlistPath = path.join(dataPath, 'wishlist.txt');

  // Check if WishlistItem table already has data (skip migration if so)
  const wishlistCount = await WishlistItem.count();

  if (wishlistCount > 0) {
    logger.debug('[wishlist-migration] WishlistItem table already has data, skipping migration');

    return;
  }

  // Check if there's anything to migrate
  const hasWishlistFile = fs.existsSync(wishlistPath);
  const downloadedItemCount = await DownloadedItem.count();
  const downloadTaskCount = await DownloadTask.count();

  if (!hasWishlistFile && downloadedItemCount === 0 && downloadTaskCount === 0) {
    logger.debug('[wishlist-migration] No wishlist data to migrate');

    return;
  }

  logger.info('[wishlist-migration] Starting wishlist to database migration...');

  // Track created WishlistItems by key for FK linking
  const wishlistItemsByKey = new Map<string, WishlistItem>();
  let createdFromFile = 0;
  let createdFromDownloaded = 0;
  let linkedTasks = 0;

  // Step 1: Parse wishlist.txt and create WishlistItem records
  if (hasWishlistFile) {
    try {
      const content = fs.readFileSync(wishlistPath, 'utf-8');
      const lines = content.split('\n').filter(line => line.trim().length > 0);

      logger.info(`[wishlist-migration] Processing ${ lines.length } lines from wishlist.txt`);

      for (const line of lines) {
        const parsed = parseWishlistLine(line);

        if (!parsed) {
          logger.debug(`[wishlist-migration] Skipping unparseable line: ${ line }`);
          continue;
        }

        const { artist, album, type } = parsed;
        const wishlistKey = buildWishlistKey(artist, album);

        // Skip if already created (deduplication)
        if (wishlistItemsByKey.has(wishlistKey)) {
          continue;
        }

        // Lookup metadata from QueueItem (most recent approved item)
        const queueItem = await QueueItem.findOne({
          where: {
            artist,
            album,
            status: 'approved',
          },
          order: [['processedAt', 'DESC']],
        });

        // Create WishlistItem with metadata
        const wishlistItem = await WishlistItem.create({
          artist,
          album,
          type,
          year:     queueItem?.year ?? undefined,
          mbid:     queueItem?.mbid ?? undefined,
          source:   queueItem?.source ?? 'manual',
          coverUrl: queueItem?.coverUrl ?? undefined,
          addedAt:  queueItem?.processedAt ?? new Date(),
        });

        wishlistItemsByKey.set(wishlistKey, wishlistItem);
        createdFromFile++;
      }

      logger.info(`[wishlist-migration] Created ${ createdFromFile } WishlistItem records from wishlist.txt`);
    } catch(error) {
      logger.error('[wishlist-migration] Failed to parse wishlist.txt:', { error });
    }
  }

  // Step 2: Import DownloadedItem records (set processedAt on WishlistItem)
  if (downloadedItemCount > 0) {
    try {
      const downloadedItems = await DownloadedItem.findAll();

      logger.info(`[wishlist-migration] Processing ${ downloadedItems.length } DownloadedItem records`);

      for (const downloaded of downloadedItems) {
        // Parse the wishlistKey to extract artist/album
        // DownloadedItem.wishlistKey format: "artist - album"
        const match = downloaded.wishlistKey.match(/^(.+) - (.+)$/);

        if (!match) {
          logger.debug(`[wishlist-migration] Skipping unparseable DownloadedItem key: ${ downloaded.wishlistKey }`);
          continue;
        }

        const [, artist, album] = match;
        const wishlistKey = downloaded.wishlistKey;

        // Check if WishlistItem already exists from wishlist.txt
        let wishlistItem = wishlistItemsByKey.get(wishlistKey);

        if (wishlistItem) {
          // Update existing with processedAt
          await wishlistItem.update({ processedAt: downloaded.downloadedAt });
        } else {
          // Lookup metadata from QueueItem
          const queueItem = await QueueItem.findOne({
            where: {
              artist,
              album,
              status: 'approved',
            },
            order: [['processedAt', 'DESC']],
          });

          // Create new WishlistItem with processedAt set
          wishlistItem = await WishlistItem.create({
            artist,
            album,
            type:        'album', // Assume album for legacy DownloadedItem
            year:        queueItem?.year ?? undefined,
            mbid:        queueItem?.mbid ?? undefined,
            source:      queueItem?.source ?? 'manual',
            coverUrl:    queueItem?.coverUrl ?? undefined,
            addedAt:     queueItem?.processedAt ?? downloaded.downloadedAt,
            processedAt: downloaded.downloadedAt,
          });

          wishlistItemsByKey.set(wishlistKey, wishlistItem);
          createdFromDownloaded++;
        }
      }

      logger.info(`[wishlist-migration] Created ${ createdFromDownloaded } additional WishlistItem records from DownloadedItem`);
    } catch(error) {
      logger.error('[wishlist-migration] Failed to process DownloadedItem records:', { error });
    }
  }

  // Step 3: Link existing DownloadTask records via wishlistItemId FK
  if (downloadTaskCount > 0) {
    try {
      const downloadTasks = await DownloadTask.findAll();

      logger.info(`[wishlist-migration] Linking ${ downloadTasks.length } DownloadTask records`);

      for (const task of downloadTasks) {
        const wishlistItem = wishlistItemsByKey.get(task.wishlistKey);

        if (wishlistItem) {
          await task.update({ wishlistItemId: wishlistItem.id });
          linkedTasks++;
        } else {
          // Create a WishlistItem for orphaned DownloadTask
          const newWishlistItem = await WishlistItem.create({
            artist:      task.artist,
            album:       task.album,
            type:        task.type,
            year:        task.year ?? undefined,
            addedAt:     task.queuedAt,
            processedAt: task.queuedAt,
          });

          await task.update({ wishlistItemId: newWishlistItem.id });
          wishlistItemsByKey.set(task.wishlistKey, newWishlistItem);
          linkedTasks++;
        }
      }

      logger.info(`[wishlist-migration] Linked ${ linkedTasks } DownloadTask records`);
    } catch(error) {
      logger.error('[wishlist-migration] Failed to link DownloadTask records:', { error });
    }
  }

  // Step 4: Backup wishlist.txt
  if (hasWishlistFile) {
    try {
      const backupPath = `${ wishlistPath }.bak`;

      fs.renameSync(wishlistPath, backupPath);
      logger.info(`[wishlist-migration] Backed up wishlist.txt to wishlist.txt.bak`);
    } catch(error) {
      logger.error('[wishlist-migration] Failed to backup wishlist.txt:', { error });
    }
  }

  logger.info(`[wishlist-migration] Migration complete: ${ createdFromFile + createdFromDownloaded } WishlistItem records created, ${ linkedTasks } DownloadTask records linked`);
}

/**
 * Standalone migration script.
 * Can be run directly: pnpm tsx src/scripts/migrate-wishlist-to-db.ts
 */
async function main(): Promise<void> {
  const { initDb, stopDb } = await import('@server/config/db');

  try {
    logger.info('[wishlist-migration] Running standalone migration...');
    await initDb();
    await migrateWishlistToDb();
    await stopDb();
    logger.info('[wishlist-migration] Migration complete');
    process.exit(0);
  } catch(error) {
    logger.error('[wishlist-migration] Migration failed:', { error });
    process.exit(1);
  }
}

// Run if this is the main module
if (require.main === module) {
  main();
}
