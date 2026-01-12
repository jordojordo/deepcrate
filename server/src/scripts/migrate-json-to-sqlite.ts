import fs from 'fs';
import path from 'path';

import logger from '@server/config/logger';
import { getDataPath } from '@server/config/settings';
import QueueItem from '@server/models/QueueItem';
import ProcessedRecording from '@server/models/ProcessedRecording';
import CatalogArtist from '@server/models/CatalogArtist';
import DiscoveredArtist from '@server/models/DiscoveredArtist';
import DownloadedItem from '@server/models/DownloadedItem';

/**
 * Migrate JSON data files to SQLite database
 * This is a one-time migration that runs on first startup
 */
export async function migrateJsonToSqlite(): Promise<void> {
  const dataPath = getDataPath();

  // Check if any tables already have data (skip migration if so)
  const queueCount = await QueueItem.count();

  if (queueCount > 0) {
    logger.debug('Database already has data, skipping JSON migration');

    return;
  }

  logger.info('Starting JSON to SQLite migration...');

  let migratedAny = false;

  // 1. Migrate pending_queue.json
  const pendingQueuePath = path.join(dataPath, 'pending_queue.json');

  if (fs.existsSync(pendingQueuePath)) {
    try {
      const data = JSON.parse(fs.readFileSync(pendingQueuePath, 'utf-8'));
      const pending = data.pending || [];

      logger.info(`Migrating ${ pending.length } items from pending_queue.json...`);

      for (const item of pending) {
        await QueueItem.create({
          artist:      item.artist,
          album:       item.album || null,
          title:       item.title || null,
          mbid:        item.mbid,
          type:        item.type || 'album',
          status:      'pending',
          addedAt:     item.added_at ? new Date(item.added_at) : new Date(),
          score:       item.score || null,
          source:      item.source,
          similarTo:   item.similar_to || null,
          sourceTrack: item.source_track || null,
          coverUrl:    item.cover_url || null,
          year:        item.year || null,
        });
      }

      // Backup original file
      fs.renameSync(pendingQueuePath, `${ pendingQueuePath }.bak`);
      logger.info(`Migrated ${ pending.length } pending queue items`);
      migratedAny = true;
    } catch(error) {
      logger.error('Failed to migrate pending_queue.json:', { error });
    }
  }

  // 2. Migrate processed.json
  const processedPath = path.join(dataPath, 'processed.json');

  if (fs.existsSync(processedPath)) {
    try {
      const processed = JSON.parse(fs.readFileSync(processedPath, 'utf-8'));
      const mbids = Array.isArray(processed) ? processed : [];

      logger.info(`Migrating ${ mbids.length } items from processed.json...`);

      for (const mbid of mbids) {
        await ProcessedRecording.create({
          mbid,
          source:      'listenbrainz', // Assume listenbrainz for legacy data
          processedAt: new Date(),
        });
      }

      // Backup original file
      fs.renameSync(processedPath, `${ processedPath }.bak`);
      logger.info(`Migrated ${ mbids.length } processed recordings`);
      migratedAny = true;
    } catch(error) {
      logger.error('Failed to migrate processed.json:', { error });
    }
  }

  // 3. Migrate catalog_artists.json
  const catalogArtistsPath = path.join(dataPath, 'catalog_artists.json');

  if (fs.existsSync(catalogArtistsPath)) {
    try {
      const artists = JSON.parse(fs.readFileSync(catalogArtistsPath, 'utf-8'));
      const artistList = Array.isArray(artists) ? artists : [];

      logger.info(`Migrating ${ artistList.length } items from catalog_artists.json...`);

      for (const artist of artistList) {
        await CatalogArtist.create({
          navidromeId:  artist.navidrome_id || artist.id,
          name:         artist.name,
          nameLower:    artist.name.toLowerCase(),
          lastSyncedAt: artist.last_synced_at ? new Date(artist.last_synced_at) : new Date(),
        });
      }

      // Backup original file
      fs.renameSync(catalogArtistsPath, `${ catalogArtistsPath }.bak`);
      logger.info(`Migrated ${ artistList.length } catalog artists`);
      migratedAny = true;
    } catch(error) {
      logger.error('Failed to migrate catalog_artists.json:', { error });
    }
  }

  // 4. Migrate catalog_discovered.json
  const catalogDiscoveredPath = path.join(dataPath, 'catalog_discovered.json');

  if (fs.existsSync(catalogDiscoveredPath)) {
    try {
      const discovered = JSON.parse(fs.readFileSync(catalogDiscoveredPath, 'utf-8'));
      const artistNames = Array.isArray(discovered) ? discovered : [];

      logger.info(`Migrating ${ artistNames.length } items from catalog_discovered.json...`);

      for (const name of artistNames) {
        await DiscoveredArtist.create({
          nameLower:    name.toLowerCase(),
          discoveredAt: new Date(),
        });
      }

      // Backup original file
      fs.renameSync(catalogDiscoveredPath, `${ catalogDiscoveredPath }.bak`);
      logger.info(`Migrated ${ artistNames.length } discovered artists`);
      migratedAny = true;
    } catch(error) {
      logger.error('Failed to migrate catalog_discovered.json:', { error });
    }
  }

  // 5. Migrate downloaded.json
  const downloadedPath = path.join(dataPath, 'downloaded.json');

  if (fs.existsSync(downloadedPath)) {
    try {
      const downloaded = JSON.parse(fs.readFileSync(downloadedPath, 'utf-8'));
      const items = Array.isArray(downloaded) ? downloaded : [];

      logger.info(`Migrating ${ items.length } items from downloaded.json...`);

      for (const item of items) {
        // downloaded.json contains wishlist keys like 'a:"Artist - Album"'
        const wishlistKey = typeof item === 'string' ? item : item.key || '';

        await DownloadedItem.create({
          wishlistKey,
          downloadedAt: new Date(),
        });
      }

      // Backup original file
      fs.renameSync(downloadedPath, `${ downloadedPath }.bak`);
      logger.info(`Migrated ${ items.length } downloaded items`);
      migratedAny = true;
    } catch(error) {
      logger.error('Failed to migrate downloaded.json:', { error });
    }
  }

  if (migratedAny) {
    logger.info('JSON to SQLite migration complete');
  } else {
    logger.debug('No JSON files found to migrate');
  }
}

/**
 * Standalone migration script
 * Can be run directly: pnpm tsx src/scripts/migrate-json-to-sqlite.ts
 */
async function main(): Promise<void> {
  const { initDb, stopDb } = await import('@server/config/db');

  try {
    logger.info('Running standalone migration...');
    await initDb();
    await migrateJsonToSqlite();
    await stopDb();
    logger.info('Migration complete');
    process.exit(0);
  } catch(error) {
    logger.error('Migration failed:', { error });
    process.exit(1);
  }
}

// Run if this is the main module
if (require.main === module) {
  main();
}
