import { DataTypes, type DataType } from '@sequelize/core';

import logger from '@server/config/logger';
import { sequelize } from '@server/config/db/sequelize';

/**
 * Schema migrations for existing databases.
 *
 * These migrations add new columns to existing tables. They must run BEFORE
 * sequelize.sync() because sync() may try to create indexes on columns that
 * don't exist yet.
 *
 * Each migration is idempotent - safe to run multiple times.
 */

interface ColumnMigration {
  table:      string;
  column:     string;
  definition: {
    type:          DataType;
    allowNull?:    boolean;
    defaultValue?: unknown;
  };
}

/**
 * List of column migrations to apply.
 * Add new migrations here as the schema evolves.
 */
const COLUMN_MIGRATIONS: ColumnMigration[] = [
  {
    table:      'download_tasks',
    column:     'organized_at',
    definition: {
      type:      DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    table:      'download_tasks',
    column:     'download_path',
    definition: {
      type:      DataTypes.STRING(2000),
      allowNull: true,
    },
  },
];

/**
 * Check if a table exists in the database.
 */
async function tableExists(tableName: string): Promise<boolean> {
  try {
    const [results] = await sequelize.query(
      `SELECT name FROM sqlite_master WHERE type='table' AND name=?`,
      { replacements: [tableName] },
    );

    return (results as { name: string }[]).length > 0;
  } catch {
    return false;
  }
}

/**
 * Check if a column exists in a table.
 */
async function columnExists(tableName: string, columnName: string): Promise<boolean> {
  try {
    const [results] = await sequelize.query(`PRAGMA table_info(${ tableName })`);

    return (results as { name: string }[]).some((col) => col.name === columnName);
  } catch {
    return false;
  }
}

/**
 * Apply all pending schema migrations.
 *
 * This function is idempotent - it checks if each migration has already been
 * applied before attempting to apply it.
 *
 * @returns Number of migrations applied
 */
export async function runSchemaMigrations(): Promise<number> {
  const queryInterface = sequelize.getQueryInterface();
  let appliedCount = 0;

  for (const migration of COLUMN_MIGRATIONS) {
    const { table, column, definition } = migration;

    // Skip if table doesn't exist (will be created by sync())
    if (!(await tableExists(table))) {
      logger.debug(`[migrations] Table ${ table } does not exist, skipping ${ column } migration`);
      continue;
    }

    // Skip if column already exists
    if (await columnExists(table, column)) {
      logger.debug(`[migrations] Column ${ table }.${ column } already exists`);
      continue;
    }

    // Add the column
    try {
      await queryInterface.addColumn(table, column, definition);
      logger.info(`[migrations] Added column ${ table }.${ column }`);
      appliedCount++;
    } catch(error) {
      logger.error(`[migrations] Failed to add column ${ table }.${ column }`, { error: (error as Error)?.message ?? String(error) });
      throw error;
    }
  }

  if (appliedCount > 0) {
    logger.info(`[migrations] Applied ${ appliedCount } schema migration(s)`);
  } else {
    logger.debug('[migrations] No schema migrations needed');
  }

  return appliedCount;
}

/**
 * Standalone migration script.
 * Can be run directly: pnpm tsx src/scripts/schema-migrations.ts
 */
async function main(): Promise<void> {
  try {
    logger.info('[migrations] Running standalone schema migrations...');

    await sequelize.authenticate();
    const count = await runSchemaMigrations();

    await sequelize.close();

    logger.info(`[migrations] Complete. Applied ${ count } migration(s).`);
    process.exit(0);
  } catch(error) {
    logger.error('[migrations] Failed:', { error });
    process.exit(1);
  }
}

// Run if this is the main module
if (require.main === module) {
  main();
}
