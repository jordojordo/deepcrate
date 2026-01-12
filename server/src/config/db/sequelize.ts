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

const DB_FILE = process.env.RESONANCE_DB_FILE || path.join(DATA_DIR, 'resonance.sqlite');

export const sequelize = new Sequelize({
  dialect: SqliteDialect,
  storage: DB_FILE,
  logging: process.env.RESONANCE_DB_LOGGING === 'true' ? (msg) => logger.debug(msg) : false,
  define:  {
    // All tables use snake_case column names in the database
    underscored: true,
  },
});

export { DB_FILE, DATA_DIR };
