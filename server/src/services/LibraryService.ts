import { Op } from '@sequelize/core';
import logger from '@server/config/logger';
import { getConfig } from '@server/config/settings';
import { SubsonicClient } from '@server/services/clients/SubsonicClient';
import LibraryAlbum from '@server/models/LibraryAlbum';
import QueueItem from '@server/models/QueueItem';

/**
 * Normalize a string for comparison: lowercase and trim whitespace.
 */
function normalizeString(str: string): string {
  return str.toLowerCase().trim();
}

/**
 * Create a lookup key from artist and album for batch checks.
 */
function createLookupKey(artist: string, album: string): string {
  return `${ normalizeString(artist) }:::${ normalizeString(album) }`;
}

export interface LibraryStats {
  totalAlbums:  number;
  lastSyncedAt: Date | null;
}

/**
 * LibraryService manages the library album cache and duplicate detection.
 */
export class LibraryService {
  private subsonicClient: SubsonicClient | null = null;

  /**
   * Get or create the Subsonic client based on configuration.
   */
  private getSubsonicClient(): SubsonicClient | null {
    if (this.subsonicClient) {
      return this.subsonicClient;
    }

    const config = getConfig();
    const subsonic = config.catalog_discovery?.subsonic;

    if (!subsonic?.host || !subsonic?.username || !subsonic?.password) {
      return null;
    }

    this.subsonicClient = new SubsonicClient(
      subsonic.host,
      subsonic.username,
      subsonic.password
    );

    return this.subsonicClient;
  }

  /**
   * Sync albums from Subsonic server to the local LibraryAlbum cache.
   * Returns the number of albums synced.
   */
  async syncLibraryAlbums(): Promise<number> {
    const client = this.getSubsonicClient();

    if (!client) {
      logger.warn('Subsonic server not configured, skipping library sync');

      return 0;
    }

    logger.info('Starting library album sync from Subsonic server...');

    const albums = await client.getAlbums();

    if (albums.length === 0) {
      logger.info('No albums found in Subsonic server library');

      return 0;
    }

    const now = new Date();
    let syncedCount = 0;

    // Process albums in batches for efficiency
    const batchSize = 100;

    for (let i = 0; i < albums.length; i += batchSize) {
      const batch = albums.slice(i, i + batchSize);

      for (const album of batch) {
        try {
          await LibraryAlbum.upsert({
            navidromeId:  album.id,
            name:         album.name,
            nameLower:    normalizeString(album.name),
            artist:       album.artist,
            artistLower:  normalizeString(album.artist),
            year:         album.year,
            lastSyncedAt: now,
          });
          syncedCount++;
        } catch(error) {
          logger.error(`Failed to sync album: ${ album.artist } - ${ album.name }`, { error });
        }
      }
    }

    logger.info(`Library sync complete: synced ${ syncedCount } albums`);

    return syncedCount;
  }

  /**
   * Check if a single album exists in the user's library.
   */
  async isInLibrary(artist: string, album: string): Promise<boolean> {
    if (!artist || !album) {
      return false;
    }

    const artistLower = normalizeString(artist);
    const albumLower = normalizeString(album);

    const match = await LibraryAlbum.findOne({
      where: {
        artistLower,
        nameLower: albumLower,
      },
    });

    return match !== null;
  }

  /**
   * Check multiple albums at once for library matches.
   * Returns a Map of "artist:::album" lookup key to boolean.
   */
  async checkBatch(items: Array<{ artist: string; album: string }>): Promise<Map<string, boolean>> {
    const results = new Map<string, boolean>();

    if (items.length === 0) {
      return results;
    }

    // Initialize all to false
    for (const item of items) {
      const key = createLookupKey(item.artist, item.album);

      results.set(key, false);
    }

    // Get unique artist+album combinations
    const lookupConditions = items.map((item) => ({
      artistLower: normalizeString(item.artist),
      nameLower:   normalizeString(item.album),
    }));

    // Query library albums matching any of the conditions
    const matches = await LibraryAlbum.findAll({ where: { [Op.or]: lookupConditions } });

    // Mark matches as true
    for (const match of matches) {
      const key = `${ match.artistLower }:::${ match.nameLower }`;

      results.set(key, true);
    }

    return results;
  }

  /**
   * Get library statistics.
   */
  async getStats(): Promise<LibraryStats> {
    const totalAlbums = await LibraryAlbum.count();

    // Get the most recent sync time
    const lastSynced = await LibraryAlbum.findOne({ order: [['lastSyncedAt', 'DESC']] });

    return {
      totalAlbums,
      lastSyncedAt: lastSynced?.lastSyncedAt || null,
    };
  }

  /**
   * Re-check all pending queue items against the library.
   * Updates the inLibrary flag for items that exist in the library.
   * Returns the number of items updated.
   */
  async recheckPendingItems(): Promise<number> {
    const config = getConfig();
    const autoReject = config.library_duplicate?.auto_reject ?? false;

    // Get all pending items
    const allPendingItems = await QueueItem.findAll({ where: { status: 'pending' } });

    // Filter to only items that have albums
    const pendingItems = allPendingItems.filter((item) => item.album && item.album.trim() !== '');

    if (pendingItems.length === 0) {
      return 0;
    }

    // Prepare batch check
    const itemsToCheck = pendingItems
      .filter((item) => item.album)
      .map((item) => ({
        artist: item.artist,
        album:  item.album!,
      }));

    const libraryMatches = await this.checkBatch(itemsToCheck);

    let updatedCount = 0;

    for (const item of pendingItems) {
      if (!item.album) {
        continue;
      }

      const key = createLookupKey(item.artist, item.album);
      const inLibrary = libraryMatches.get(key) ?? false;

      // Only update if status changed
      if (item.inLibrary !== inLibrary) {
        const updates: Partial<typeof item> = { inLibrary };

        // Auto-reject if configured and item is in library
        if (autoReject && inLibrary) {
          updates.status = 'rejected';
          updates.processedAt = new Date();
          logger.info(`Auto-rejecting duplicate: ${ item.artist } - ${ item.album }`);
        }

        await QueueItem.update(updates, { where: { id: item.id, status: 'pending' } });

        updatedCount++;
      }
    }

    logger.info(`Library recheck complete: updated ${ updatedCount } queue items`);

    return updatedCount;
  }
}

export default LibraryService;
