import { createLogger, format, transports } from 'winston';
import fs from 'fs';
import path from 'path';
import { getDataPath } from './settings';

type LogLevel = 'error' | 'warn' | 'info' | 'http' | 'verbose' | 'debug' | 'silly';

function parseBooleanEnv(value: string | undefined): boolean | undefined {
  if (value === undefined) return undefined;

  switch (value.trim().toLowerCase()) {
    case 'true':
    case '1':
    case 'yes':
    case 'y':
    case 'on':
      return true;
    case 'false':
    case '0':
    case 'no':
    case 'n':
    case 'off':
      return false;
    default:
      return undefined;
  }
}

function normalizeLogLevel(value: string | undefined, fallback: LogLevel): LogLevel {
  if (!value) {
    return fallback;
  }

  const level = value.trim().toLowerCase();

  if (level === 'warning') {
    return 'warn';
  }
  if (level === 'err') {
    return 'error';
  }

  const allowed: Record<string, LogLevel> = {
    error:   'error',
    warn:    'warn',
    info:    'info',
    http:    'http',
    verbose: 'verbose',
    debug:   'debug',
    silly:   'silly',
  };

  return allowed[level] ?? fallback;
}

const logDir = process.env.LOG_DIR || getDataPath();
const isProduction = process.env.NODE_ENV === 'production';
const defaultLogLevel: LogLevel = isProduction ? 'info' : 'debug';
const logLevel = normalizeLogLevel(process.env.LOG_LEVEL, defaultLogLevel);

let enableConsole = parseBooleanEnv(process.env.LOG_TO_CONSOLE) ?? true;
let enableFile = parseBooleanEnv(process.env.LOG_TO_FILE) ?? false;

if (enableFile) {
  try {
    fs.mkdirSync(logDir, { recursive: true });
  } catch(err) {
    console.warn('Failed to create log directory, disabling file logging:', err);
    enableFile = false;
  }
}

if (!enableConsole && !enableFile) {
  console.warn('LOG_TO_CONSOLE and LOG_TO_FILE are both disabled; falling back to console logging');
  enableConsole = true;
}

const logger = createLogger({
  level:       logLevel,
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
  logger.add(new transports.File({
    filename: path.join(logDir, 'combined.log'),
    level:    logLevel,
  }));
}

if (enableConsole) {
  const useColors = !isProduction && Boolean(process.stdout.isTTY);

  logger.add(new transports.Console({
    level:             logLevel,
    stderrLevels:      ['error'],
    consoleWarnLevels: ['warn'],
    format:            format.combine(
      ...(useColors ? [format.colorize()] : []),
      format.timestamp(),
      format.errors({ stack: true }),
      format.splat(),
      format.printf((info) => {
        const level = useColors ? info.level : info.level.toUpperCase();
        const base = `${ info.timestamp } - ${ level } - ${ info.message }`;
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
