import logger from '@server/config/logger';
import DownloadService from '@server/services/DownloadService';

const PROGRESS_SYNC_INTERVAL_MS = 3000; // 3 seconds

let intervalId: ReturnType<typeof setInterval> | null = null;
let downloadService: DownloadService | null = null;

/**
 * Start the download progress sync interval.
 * This periodically polls slskd for progress and emits WebSocket events.
 */
export function startProgressSync(): void {
  if (intervalId) {
    logger.warn('Progress sync already running');

    return;
  }

  downloadService = new DownloadService();

  intervalId = setInterval(async() => {
    try {
      await downloadService!.syncAndEmitProgress();
    } catch(error) {
      logger.error('Error syncing download progress:', { error });
    }
  }, PROGRESS_SYNC_INTERVAL_MS);

  logger.info(`Started download progress sync (every ${ PROGRESS_SYNC_INTERVAL_MS }ms)`);
}

/**
 * Stop the download progress sync interval.
 */
export function stopProgressSync(): void {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
    downloadService = null;
    logger.info('Stopped download progress sync');
  }
}
