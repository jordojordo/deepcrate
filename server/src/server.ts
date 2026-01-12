import http from 'http';
import { AddressInfo } from 'net';

import logger from '@server/config/logger';
import { initDb, stopDb } from '@server/config/db';
import app from '@server/plugins/app';
import { startJobs, stopJobs } from '@server/plugins/jobs';
import { migrateJsonToSqlite } from './scripts/migrate-json-to-sqlite';

const PORT = parseInt(process.env.PORT || '8080', 10);
const HOST = process.env.HOST || '0.0.0.0';

let server: http.Server | null = null;

/**
 * Start the Resonance server
 */
async function startServer(): Promise<void> {
  try {
    logger.info('Starting Resonance server...');

    // 1. Initialize database
    logger.info('Initializing database...');
    await initDb();
    logger.info('Database initialized');

    // 2. Run data migration (if needed)
    logger.info('Checking for data migration...');
    await migrateJsonToSqlite();

    // 3. Create HTTP server
    server = http.createServer(app);

    // 4. Start listening
    await new Promise<void>((resolve, reject) => {
      server!.listen(PORT, HOST, () => {
        const addr = server!.address() as AddressInfo;

        logger.info(`Server listening on http://${ addr.address }:${ addr.port }`);
        resolve();
      });

      server!.on('error', (error) => {
        logger.error('Failed to start server:', { error });
        reject(error);
      });
    });

    // 5. Start background jobs
    logger.info('Starting background jobs...');
    startJobs();

    logger.info('Resonance server started successfully');
  } catch(error) {
    logger.error('Failed to start server:', { error });
    process.exit(1);
  }
}

/**
 * Gracefully shutdown the server
 */
async function shutdownServer(signal: string): Promise<void> {
  logger.info(`Received ${ signal }, shutting down gracefully...`);

  try {
    // 1. Stop accepting new requests
    if (server) {
      await new Promise<void>((resolve, reject) => {
        server!.close((err) => {
          if (err) {
            logger.error('Error closing server:', { error: err });
            reject(err);
          } else {
            logger.info('HTTP server closed');
            resolve();
          }
        });
      });
    }

    // 2. Stop background jobs
    logger.info('Stopping background jobs...');
    stopJobs();

    // 3. Close database connections
    logger.info('Closing database connections...');
    await stopDb();

    logger.info('Shutdown complete');
    process.exit(0);
  } catch(error) {
    logger.error('Error during shutdown:', { error });
    process.exit(1);
  }
}

/**
 * Register shutdown handlers
 */
function registerShutdownHandlers(): void {
  // Graceful shutdown on SIGTERM (Docker, Kubernetes)
  process.on('SIGTERM', () => shutdownServer('SIGTERM'));

  // Graceful shutdown on SIGINT (Ctrl+C)
  process.on('SIGINT', () => shutdownServer('SIGINT'));

  // Log unhandled rejections
  process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Promise Rejection:', {
      reason,
      promise,
    });
  });

  // Log uncaught exceptions
  process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception:', { error });
    // Exit after logging uncaught exception
    process.exit(1);
  });
}

/**
 * Main entry point
 */
async function main(): Promise<void> {
  // Register shutdown handlers first
  registerShutdownHandlers();

  // Start the server
  await startServer();
}

// Start if this is the main module
if (require.main === module) {
  main().catch((error) => {
    logger.error('Fatal error:', { error });
    process.exit(1);
  });
}

export { startServer, shutdownServer };
