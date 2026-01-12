import logger from '@server/config/logger';
import { JOB_NAMES } from '@server/constants/jobs';
import { getConfig } from '@server/config/settings';
import { WishlistService } from '@server/services/WishlistService';
import { isJobCancelled } from '@server/plugins/jobs';

/**
 * slskd Downloader Job
 *
 * Reads the wishlist.txt file and sends download requests to slskd.
 * Tracks downloaded items to avoid re-submitting the same searches.
 *
 *
 * TODO: Implement full slskd downloader logic
 */
export async function slskdDownloaderJob(): Promise<void> {
  const config = getConfig();
  const slskdConfig = config.slskd;

  if (!slskdConfig || !slskdConfig.host || !slskdConfig.api_key) {
    logger.debug('slskd not configured, skipping downloader');

    return;
  }

  logger.info('Starting slskd downloader job');

  try {
    // Check for cancellation before starting
    if (isJobCancelled(JOB_NAMES.SLSKD)) {
      logger.info('Job cancelled before processing wishlist');
      throw new Error('Job cancelled');
    }

    const wishlistService = new WishlistService();

    // Read wishlist entries
    const entries = wishlistService.readAll();

    if (entries.length === 0) {
      logger.debug('Wishlist is empty');

      return;
    }

    logger.info(`Found ${ entries.length } items in wishlist`);

    // TODO: Implement slskd downloader logic:
    // 1. Read wishlist.txt
    // 2. For each entry, check if already downloaded (DownloadedItem model)
    // 3. If not, submit search to slskd
    // 4. Wait for search results
    // 5. Enqueue files for download
    // 6. Mark as downloaded

    logger.info('slskd downloader completed (placeholder)');
  } catch(error) {
    logger.error('slskd downloader job failed:', { error });
    throw error;
  }
}
