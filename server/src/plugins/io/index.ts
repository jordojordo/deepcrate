import type http from 'http';
import { Server } from 'socket.io';

import logger from '@server/config/logger';
import { setupQueueNamespace } from './namespaces/queueNamespace';
import { setupDownloadsNamespace } from './namespaces/downloadsNamespace';
import { setupJobsNamespace } from './namespaces/jobsNamespace';

let io: Server | null = null;

/**
 * Initialize Socket.io server
 */
export function initIo(httpServer: http.Server): Server {
  if (io) {
    logger.warn('Socket.io already initialized');

    return io;
  }

  io = new Server(httpServer, {
    cors: {
      origin:      process.env.NODE_ENV === 'development' ? ['http://localhost:5173'] : false,
      credentials: true,
    },
    // Disable serving client files from server
    serveClient: false,
  });

  // Setup namespaces
  setupQueueNamespace(io);
  setupDownloadsNamespace(io);
  setupJobsNamespace(io);

  logger.info('Socket.io initialized');

  return io;
}

/**
 * Get the Socket.io server instance
 */
export function getIo(): Server | null {
  return io;
}

/**
 * Stop Socket.io server and close all connections
 */
export async function stopIo(): Promise<void> {
  if (!io) {
    return;
  }

  return new Promise((resolve) => {
    io!.close(() => {
      logger.info('Socket.io server closed');
      io = null;
      resolve();
    });
  });
}
