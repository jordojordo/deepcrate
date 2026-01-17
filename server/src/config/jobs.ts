/**
 * Job configuration and intervals
 */

/**
 * Convert seconds to cron expression
 * Handles common intervals: hourly, every N hours, daily, weekly
 */
export function secondsToCron(seconds: number): string {
  const hours = seconds / 3600;
  const days = seconds / 86400;

  // Every hour
  if (seconds === 3600) {
    return '0 * * * *';
  }

  // Every N hours (up to 23)
  if (hours >= 1 && hours < 24 && hours === Math.floor(hours)) {
    return `0 */${ hours } * * *`;
  }

  // Daily
  if (days === 1) {
    return '0 0 * * *';
  }

  // Weekly
  if (days === 7) {
    return '0 0 * * 0';
  }

  // Default: run every hour (fallback for unusual intervals)
  return '0 * * * *';
}

/**
 * Job interval configuration from environment variables
 */
export const JOB_INTERVALS = {
  listenbrainz: {
    seconds: parseInt(process.env.LB_FETCH_INTERVAL || '21600', 10), // 6 hours
    cron:    secondsToCron(parseInt(process.env.LB_FETCH_INTERVAL || '21600', 10)),
  },
  catalog: {
    seconds: parseInt(process.env.CATALOG_INTERVAL || '604800', 10), // 7 days
    cron:    secondsToCron(parseInt(process.env.CATALOG_INTERVAL || '604800', 10)),
  },
  slskd: {
    seconds: parseInt(process.env.SLSKD_INTERVAL || '3600', 10), // 1 hour
    cron:    secondsToCron(parseInt(process.env.SLSKD_INTERVAL || '3600', 10)),
  },
  librarySync: {
    seconds: parseInt(process.env.LIBRARY_SYNC_INTERVAL || '86400', 10), // 24 hours
    cron:    secondsToCron(parseInt(process.env.LIBRARY_SYNC_INTERVAL || '86400', 10)),
  },
  libraryOrganize: {
    seconds: parseInt(process.env.LIBRARY_ORGANIZE_INTERVAL || '0', 10), // disabled/manual by default
    cron:    (() => {
      const seconds = parseInt(process.env.LIBRARY_ORGANIZE_INTERVAL || '0', 10);

      return seconds > 0 ? secondsToCron(seconds) : 'manual';
    })(),
  },
};

/**
 * Should jobs run on startup?
 */
export const RUN_ON_STARTUP = process.env.RUN_JOBS_ON_STARTUP !== 'false';
