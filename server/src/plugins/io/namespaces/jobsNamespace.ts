import type { Server, Namespace } from 'socket.io';
import type {
  JobsServerToClientEvents,
  JobsClientToServerEvents,
  JobStartedEvent,
  JobProgressEvent,
  JobCompletedEvent,
  JobFailedEvent,
  JobCancelledEvent,
} from '@server/types/socket';

import logger from '@server/config/logger';
import { createAuthMiddleware } from '../authMiddleware';

const NAMESPACE = '/jobs';

let namespaceInstance: Namespace<JobsClientToServerEvents, JobsServerToClientEvents> | null = null;

/**
 * Setup the jobs namespace
 */
export function setupJobsNamespace(io: Server): void {
  namespaceInstance = io.of(NAMESPACE);

  // Apply authentication middleware
  namespaceInstance.use(createAuthMiddleware());

  namespaceInstance.on('connection', (socket) => {
    logger.debug(`[socket:jobs] Client connected: ${ socket.id }`);

    socket.on('disconnect', (reason) => {
      logger.debug(`[socket:jobs] Client disconnected: ${ socket.id }, reason: ${ reason }`);
    });
  });

  logger.info(`[socket] Namespace ${ NAMESPACE } initialized`);
}

/**
 * Emit job:started event
 */
export function emitJobStarted(event: JobStartedEvent): void {
  if (!namespaceInstance) {
    return;
  }

  try {
    namespaceInstance.emit('job:started', event);
    logger.debug(`[socket:jobs] Emitted job:started for ${ event.name }`);
  } catch(error) {
    logger.error('[socket:jobs] Error emitting job:started:', { error });
  }
}

/**
 * Emit job:progress event
 */
export function emitJobProgress(event: JobProgressEvent): void {
  if (!namespaceInstance) {
    return;
  }

  try {
    namespaceInstance.emit('job:progress', event);
    logger.silly(`[socket:jobs] Emitted job:progress for ${ event.name }: ${ event.message }`);
  } catch(error) {
    logger.error('[socket:jobs] Error emitting job:progress:', { error });
  }
}

/**
 * Emit job:completed event
 */
export function emitJobCompleted(event: JobCompletedEvent): void {
  if (!namespaceInstance) {
    return;
  }

  try {
    namespaceInstance.emit('job:completed', event);
    logger.debug(`[socket:jobs] Emitted job:completed for ${ event.name }`);
  } catch(error) {
    logger.error('[socket:jobs] Error emitting job:completed:', { error });
  }
}

/**
 * Emit job:failed event
 */
export function emitJobFailed(event: JobFailedEvent): void {
  if (!namespaceInstance) {
    return;
  }

  try {
    namespaceInstance.emit('job:failed', event);
    logger.debug(`[socket:jobs] Emitted job:failed for ${ event.name }`);
  } catch(error) {
    logger.error('[socket:jobs] Error emitting job:failed:', { error });
  }
}

/**
 * Emit job:cancelled event
 */
export function emitJobCancelled(event: JobCancelledEvent): void {
  if (!namespaceInstance) {
    return;
  }

  try {
    namespaceInstance.emit('job:cancelled', event);
    logger.debug(`[socket:jobs] Emitted job:cancelled for ${ event.name }`);
  } catch(error) {
    logger.error('[socket:jobs] Error emitting job:cancelled:', { error });
  }
}
