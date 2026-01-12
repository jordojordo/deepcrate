import { createLogger, format, transports } from 'winston';
import path from 'path';
import { getDataPath } from './settings';

const logDir = process.env.LOG_DIR || getDataPath();

const logger = createLogger({
  level:       process.env.LOG_LEVEL || 'info',
  format:      format.combine(
    format.timestamp(),
    format.errors({ stack: true }),
    format.splat(),
    format.json()
  ),
  defaultMeta: { service: 'resonance' },
  transports:  [
    new transports.File({
      filename: path.join(logDir, 'error.log'),
      level:    'error'
    }),
    new transports.File({ filename: path.join(logDir, 'combined.log') }),
  ],
});

// Add console transport in development
if (process.env.NODE_ENV !== 'production') {
  logger.add(new transports.Console({
    format: format.combine(
      format.colorize(),
      format.simple()
    ),
  }));
}

export default logger;
