import path from 'path';
import fs from 'fs';
import { Sequelize } from '@sequelize/core';
import { SqliteDialect } from '@sequelize/sqlite3';
import logger from '@server/config/logger';
import { getDataPath } from '@server/config/settings';

const DATA_DIR = getDataPath();

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function resolveDbFile(): string {
  if (process.env.DEEPCRATE_DB_FILE) {
    return process.env.DEEPCRATE_DB_FILE;
  }

  const newPath = path.join(DATA_DIR, 'deepcrate.sqlite');
  const legacyPath = path.join(DATA_DIR, 'resonance.sqlite');

  if (!fs.existsSync(newPath) && fs.existsSync(legacyPath)) {
    logger.warn(
      'DEPRECATION: '
      + 'Using legacy database file \'resonance.sqlite\'. '
      + 'Please rename to \'deepcrate.sqlite\'. '
      + 'This fallback will be removed in a future version.'
    );

    return legacyPath;
  }

  return newPath;
}

const DB_FILE = resolveDbFile();

export const sequelize = new Sequelize({
  dialect: SqliteDialect,
  storage: DB_FILE,
  logging: process.env.DEEPCRATE_DB_LOGGING === 'true' ? (msg) => logger.debug(msg) : false,
  define:  {
    // All tables use snake_case column names in the database
    underscored: true,
  },
});

export { DB_FILE, DATA_DIR };
