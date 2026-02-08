import http from 'http';
import { AddressInfo } from 'net';

import logger from '@server/config/logger';
import { initDb, stopDb } from '@server/config/db';
import app from '@server/plugins/app';
import { startJobs, stopJobs } from '@server/plugins/jobs';
import { initIo, stopIo } from '@server/plugins/io';
import { startProgressSync, stopProgressSync } from '@server/plugins/progressSync';
import { migrateJsonToSqlite } from './scripts/migrate-json-to-sqlite';
import { migrateWishlistToDb } from './scripts/migrate-wishlist-to-db';

const PORT = parseInt(process.env.PORT || '8080', 10);
const HOST = process.env.HOST || '0.0.0.0';

let server: http.Server | null = null;

async function startServer(): Promise<void> {
  try {
    logger.info('Starting DeepCrate server...');

    logger.info('Initializing database...');
    await initDb();
    logger.info('Database initialized');

    logger.info('Checking for data migration...');
    await migrateJsonToSqlite();
    await migrateWishlistToDb();

    server = http.createServer(app);

    logger.info('Initializing Socket.io...');
    initIo(server);

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

    logger.info('Starting background jobs...');
    startJobs();

    logger.info('Starting download progress sync...');
    startProgressSync();

    logger.info('DeepCrate server started successfully');
  } catch(error) {
    logger.error('Failed to start server:', { error });
    process.exit(1);
  }
}

async function shutdownServer(signal: string): Promise<void> {
  logger.info(`Received ${ signal }, shutting down gracefully...`);

  try {
    logger.info('Closing Socket.io connections...');
    await stopIo();

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

    logger.info('Stopping background jobs...');
    stopJobs();

    logger.info('Stopping download progress sync...');
    stopProgressSync();

    logger.info('Closing database connections...');
    await stopDb();

    logger.info('Shutdown complete');
    process.exit(0);
  } catch(error) {
    logger.error('Error during shutdown:', { error });
    process.exit(1);
  }
}

function registerShutdownHandlers(): void {
  // Graceful shutdown on SIGTERM (Docker, Kubernetes)
  process.on('SIGTERM', () => shutdownServer('SIGTERM'));

  // Graceful shutdown on SIGINT (Ctrl+C)
  process.on('SIGINT', () => shutdownServer('SIGINT'));

  process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Promise Rejection:', {
      reason,
      promise,
    });
  });

  process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception:', { error });
    process.exit(1);
  });
}

async function main(): Promise<void> {
  registerShutdownHandlers();

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
