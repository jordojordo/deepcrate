import logger from '@server/config/logger';
import { JOB_NAMES } from '@server/constants/jobs';
import { getConfig } from '@server/config/settings';
import { LibraryService } from '@server/services/LibraryService';
import { isJobCancelled } from '@server/plugins/jobs';

/**
 * Library Sync Job
 *
 * Syncs albums from Subsonic server to the local cache and re-checks pending items
 * for library duplicates.
 */
export async function librarySyncJob(): Promise<void> {
  const config = getConfig();
  const libraryDuplicate = config.library_duplicate;

  if (!libraryDuplicate || !libraryDuplicate.enabled) {
    logger.debug('Library duplicate detection not enabled, skipping sync');

    return;
  }

  const subsonic = config.catalog_discovery?.subsonic;

  if (!subsonic?.host || !subsonic?.username || !subsonic?.password) {
    logger.warn('Subsonic server not configured, skipping library sync');

    return;
  }

  logger.info('Starting library sync job');

  const libraryService = new LibraryService();

  try {
    if (isJobCancelled(JOB_NAMES.LIBRARY_SYNC)) {
      logger.info('Job cancelled before syncing library');
      throw new Error('Job cancelled');
    }

    const syncedCount = await libraryService.syncLibraryAlbums();

    logger.info(`Synced ${ syncedCount } albums from library`);

    if (isJobCancelled(JOB_NAMES.LIBRARY_SYNC)) {
      logger.info('Job cancelled before re-checking pending items');
      throw new Error('Job cancelled');
    }

    const updatedCount = await libraryService.recheckPendingItems();

    logger.info(`Updated ${ updatedCount } queue items with library status`);

    logger.info('Library sync job completed');
  } catch(error) {
    logger.error('Library sync job failed:', { error });
    throw error;
  }
}
