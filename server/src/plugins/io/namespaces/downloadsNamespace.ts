import type { Server, Namespace } from 'socket.io';
import type {
  DownloadsServerToClientEvents,
  DownloadsClientToServerEvents,
  DownloadTaskCreatedEvent,
  DownloadTaskUpdatedEvent,
  DownloadProgressEvent,
  DownloadStatsUpdatedEvent,
  DownloadPendingSelectionEvent,
  DownloadSelectionExpiredEvent,
} from '@server/types/socket';

import logger from '@server/config/logger';
import { createAuthMiddleware } from '../authMiddleware';

const NAMESPACE = '/downloads';
const PROGRESS_THROTTLE_MS = 2000;

let namespaceInstance: Namespace<DownloadsClientToServerEvents, DownloadsServerToClientEvents> | null = null;

// Track last progress emission time per download task
const progressThrottleMap = new Map<string, number>();

/**
 * Setup the downloads namespace
 */
export function setupDownloadsNamespace(io: Server): void {
  namespaceInstance = io.of(NAMESPACE);

  // Apply authentication middleware
  namespaceInstance.use(createAuthMiddleware());

  namespaceInstance.on('connection', (socket) => {
    logger.debug(`[socket:downloads] Client connected: ${ socket.id }`);

    socket.on('disconnect', (reason) => {
      logger.debug(`[socket:downloads] Client disconnected: ${ socket.id }, reason: ${ reason }`);
    });
  });

  logger.info(`[socket] Namespace ${ NAMESPACE } initialized`);
}

/**
 * Emit download:task:created event
 */
export function emitDownloadTaskCreated(event: DownloadTaskCreatedEvent): void {
  if (!namespaceInstance) {
    return;
  }

  try {
    namespaceInstance.emit('download:task:created', event);
    logger.silly(`[socket:downloads] Emitted download:task:created for ${ event.task.id }`);
  } catch(error) {
    logger.error('[socket:downloads] Error emitting download:task:created:', { error });
  }
}

/**
 * Emit download:task:updated event
 */
export function emitDownloadTaskUpdated(event: DownloadTaskUpdatedEvent): void {
  if (!namespaceInstance) {
    return;
  }

  try {
    namespaceInstance.emit('download:task:updated', event);
    logger.silly(`[socket:downloads] Emitted download:task:updated for ${ event.id }`);

    // Clean up throttle map when task completes or fails
    if (event.status === 'completed' || event.status === 'failed') {
      progressThrottleMap.delete(event.id);
    }
  } catch(error) {
    logger.error('[socket:downloads] Error emitting download:task:updated:', { error });
  }
}

/**
 * Emit download:progress event (throttled per task)
 */
export function emitDownloadProgress(event: DownloadProgressEvent): void {
  if (!namespaceInstance) {
    return;
  }

  // Check throttle
  const now = Date.now();
  const lastEmit = progressThrottleMap.get(event.id) || 0;

  if (now - lastEmit < PROGRESS_THROTTLE_MS) {
    return;
  }

  progressThrottleMap.set(event.id, now);

  try {
    namespaceInstance.emit('download:progress', event);
    logger.silly(`[socket:downloads] Emitted download:progress for ${ event.id }`);
  } catch(error) {
    logger.error('[socket:downloads] Error emitting download:progress:', { error });
  }
}

/**
 * Emit download:stats:updated event
 */
export function emitDownloadStatsUpdated(event: DownloadStatsUpdatedEvent): void {
  if (!namespaceInstance) {
    return;
  }

  try {
    namespaceInstance.emit('download:stats:updated', event);
    logger.silly('[socket:downloads] Emitted download:stats:updated');
  } catch(error) {
    logger.error('[socket:downloads] Error emitting download:stats:updated:', { error });
  }
}

/**
 * Emit download:pending_selection event
 */
export function emitDownloadPendingSelection(event: DownloadPendingSelectionEvent): void {
  if (!namespaceInstance) {
    return;
  }

  try {
    namespaceInstance.emit('download:pending_selection', event);
    logger.silly(`[socket:downloads] Emitted download:pending_selection for ${ event.id }`);
  } catch(error) {
    logger.error('[socket:downloads] Error emitting download:pending_selection:', { error });
  }
}

/**
 * Emit download:selection_expired event
 */
export function emitDownloadSelectionExpired(event: DownloadSelectionExpiredEvent): void {
  if (!namespaceInstance) {
    return;
  }

  try {
    namespaceInstance.emit('download:selection_expired', event);
    logger.silly(`[socket:downloads] Emitted download:selection_expired for ${ event.id }`);
  } catch(error) {
    logger.error('[socket:downloads] Error emitting download:selection_expired:', { error });
  }
}
