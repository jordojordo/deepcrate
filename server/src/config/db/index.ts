import logger from '@server/config/logger';
import { sequelize } from './sequelize';
import { runSchemaMigrations } from '@server/scripts/schema-migrations';
import QueueItem from '@server/models/QueueItem';
import ProcessedRecording from '@server/models/ProcessedRecording';
import CatalogArtist from '@server/models/CatalogArtist';
import DiscoveredArtist from '@server/models/DiscoveredArtist';
import DownloadedItem from '@server/models/DownloadedItem';
import WishlistItem from '@server/models/WishlistItem';

// Export models for use in services
export {
  QueueItem,
  ProcessedRecording,
  CatalogArtist,
  DiscoveredArtist,
  DownloadedItem,
  WishlistItem,
};

// Export mutex utilities for serializing write operations
export {
  dbWriteMutex, withDbWrite, DB_WRITE_TIMEOUT_MS 
} from './mutex';

// Models don't have any associations for now
// (they are independent tables tracking different aspects of the discovery pipeline)

/**
 * Initialize database connection and sync models.
 *
 * Called during server startup before accepting requests.
 */
export async function initDb(): Promise<void> {
  try {
    await sequelize.authenticate();

    // Run schema migrations BEFORE sync to add columns that indexes depend on
    await runSchemaMigrations();

    // Sync tables from model definitions (creates tables, indexes, etc.)
    await sequelize.sync();

    logger.info('[db] connected and synced', { file: process.env.DEEPCRATE_DB_FILE });
  } catch(error) {
    logger.error('[db] failed to initialize', { error: (error as Error)?.message ?? String(error) });

    throw error;
  }
}

/**
 * Close database connection.
 *
 * Called during graceful shutdown (SIGTERM/SIGINT).
 */
export async function stopDb(): Promise<void> {
  try {
    await sequelize.close();
    logger.info('[db] closed');
  } catch(error) {
    logger.error('[db] failed to stop', { error: (error as Error)?.message ?? String(error) });

    throw error;
  }
}

export { sequelize };
