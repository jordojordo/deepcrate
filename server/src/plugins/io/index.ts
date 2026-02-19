import type http from 'http';

import { Server } from 'socket.io';

import logger from '@server/config/logger';
import { setupQueueNamespace } from './namespaces/queueNamespace';
import { setupDownloadsNamespace } from './namespaces/downloadsNamespace';
import { setupJobsNamespace } from './namespaces/jobsNamespace';
import { setupActivityNamespace } from './namespaces/activityNamespace';

let io: Server | null = null;

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

  setupQueueNamespace(io);
  setupDownloadsNamespace(io);
  setupJobsNamespace(io);
  setupActivityNamespace(io);

  logger.info('Socket.io initialized');

  return io;
}

export function getIo(): Server | null {
  return io;
}

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
