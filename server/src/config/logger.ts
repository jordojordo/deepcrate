import { createLogger, format, transports } from 'winston';
import fs from 'fs';
import path from 'path';
import { getDataPath } from './settings';

const logDir = process.env.LOG_DIR || getDataPath();
const isProduction = process.env.NODE_ENV === 'production';
const enableConsole = !isProduction || process.env.LOG_TO_CONSOLE === 'true';
const enableFile = isProduction || process.env.LOG_TO_FILE === 'true';

if (enableFile) {
  try {
    fs.mkdirSync(logDir, { recursive: true });
  } catch(err) {
    console.warn('Failed to create log directory, falling back to console-only logging:', err);
  }
}

const logger = createLogger({
  level:       process.env.LOG_LEVEL || (isProduction ? 'info' : 'debug'),
  format:      format.combine(
    format.timestamp(),
    format.errors({ stack: true }),
    format.splat(),
    format.json()
  ),
  defaultMeta: { service: 'resonance' },
  transports:  [],
});

if (enableFile && fs.existsSync(logDir)) {
  logger.add(new transports.File({
    filename: path.join(logDir, 'error.log'),
    level:    'error',
  }));
  logger.add(new transports.File({ filename: path.join(logDir, 'combined.log') }));
}

if (enableConsole) {
  logger.add(new transports.Console({
    format: format.combine(
      format.colorize(),
      format.timestamp(),
      format.errors({ stack: true }),
      format.printf((info) => {
        const base = `${ info.timestamp } ${ info.level }: ${ info.message }`;
        const rest = { ...info };

        delete (rest as Record<string, unknown>).timestamp;
        delete (rest as Record<string, unknown>).level;
        delete (rest as Record<string, unknown>).message;

        const meta = Object.keys(rest).length ? ` ${ JSON.stringify(rest) }` : '';

        return `${ base }${ meta }`;
      })
    ),
  }));
}

export default logger;
