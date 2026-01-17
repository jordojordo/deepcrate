import type { Server, Namespace } from 'socket.io';
import type {
  QueueServerToClientEvents,
  QueueClientToServerEvents,
  QueueItemAddedEvent,
  QueueItemUpdatedEvent,
  QueueStatsUpdatedEvent,
} from '@server/types/socket';

import logger from '@server/config/logger';
import { createAuthMiddleware } from '../authMiddleware';

const NAMESPACE = '/queue';

let namespaceInstance: Namespace<QueueClientToServerEvents, QueueServerToClientEvents> | null = null;

/**
 * Setup the queue namespace
 */
export function setupQueueNamespace(io: Server): void {
  namespaceInstance = io.of(NAMESPACE);

  // Apply authentication middleware
  namespaceInstance.use(createAuthMiddleware());

  namespaceInstance.on('connection', (socket) => {
    logger.debug(`[socket:queue] Client connected: ${ socket.id }`);

    socket.on('disconnect', (reason) => {
      logger.debug(`[socket:queue] Client disconnected: ${ socket.id }, reason: ${ reason }`);
    });
  });

  logger.info(`[socket] Namespace ${ NAMESPACE } initialized`);
}

/**
 * Emit queue:item:added event
 */
export function emitQueueItemAdded(event: QueueItemAddedEvent): void {
  if (!namespaceInstance) {
    return;
  }

  try {
    namespaceInstance.emit('queue:item:added', event);
    logger.debug(`[socket:queue] Emitted queue:item:added for ${ event.item.mbid }`);
  } catch(error) {
    logger.error('[socket:queue] Error emitting queue:item:added:', { error });
  }
}

/**
 * Emit queue:item:updated event
 */
export function emitQueueItemUpdated(event: QueueItemUpdatedEvent): void {
  if (!namespaceInstance) {
    return;
  }

  try {
    namespaceInstance.emit('queue:item:updated', event);
    logger.debug(`[socket:queue] Emitted queue:item:updated for ${ event.mbid }`);
  } catch(error) {
    logger.error('[socket:queue] Error emitting queue:item:updated:', { error });
  }
}

/**
 * Emit queue:stats:updated event
 */
export function emitQueueStatsUpdated(event: QueueStatsUpdatedEvent): void {
  if (!namespaceInstance) {
    return;
  }

  try {
    namespaceInstance.emit('queue:stats:updated', event);
    logger.debug('[socket:queue] Emitted queue:stats:updated');
  } catch(error) {
    logger.error('[socket:queue] Error emitting queue:stats:updated:', { error });
  }
}
