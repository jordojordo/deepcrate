import type { Server, Namespace } from 'socket.io';
import type {
  ActivityServerToClientEvents,
  ActivityClientToServerEvents,
  ActivityNewEvent,
} from '@server/types/socket';

import logger from '@server/config/logger';
import { createAuthMiddleware } from '@server/plugins/io/authMiddleware';

const NAMESPACE = '/activity';

let namespaceInstance: Namespace<ActivityClientToServerEvents, ActivityServerToClientEvents> | null = null;

export function setupActivityNamespace(io: Server): void {
  namespaceInstance = io.of(NAMESPACE);

  namespaceInstance.use(createAuthMiddleware());

  namespaceInstance.on('connection', (socket) => {
    logger.debug(`[socket:activity] Client connected: ${ socket.id }`);

    socket.on('disconnect', (reason) => {
      logger.debug(`[socket:activity] Client disconnected: ${ socket.id }, reason: ${ reason }`);
    });
  });

  logger.info(`[socket] Namespace ${ NAMESPACE } initialized`);
}

export function emitActivityNew(event: ActivityNewEvent): void {
  if (!namespaceInstance) {
    return;
  }

  try {
    namespaceInstance.emit('activity:new', event);
    logger.silly(`[socket:activity] Emitted activity:new: ${ event.item.title }`);
  } catch(error) {
    logger.error('[socket:activity] Error emitting activity:new:', { error });
  }
}
