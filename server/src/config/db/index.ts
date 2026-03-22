import logger from '@server/config/logger';
import { sequelize } from './sequelize';
import { runSchemaMigrations } from '@server/scripts/schema-migrations';

// Export mutex utilities for serializing write operations
export { withDbWrite } from './mutex';

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

