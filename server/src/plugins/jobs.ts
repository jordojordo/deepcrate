import * as cron from 'node-cron';

import logger from '@server/config/logger';
import { JOB_INTERVALS, RUN_ON_STARTUP } from '@server/config/jobs';
import { listenbrainzFetchJob } from '@server/jobs/listenbrainzFetch';
import { catalogDiscoveryJob } from '@server/jobs/catalogDiscovery';
import { slskdDownloaderJob } from '@server/jobs/slskdDownloader';

/**
 * Job definitions with name, cron schedule, and handler
 */
interface JobDefinition {
  name:    string;
  cron:    string;
  handler: () => Promise<void>;
  task?:   ReturnType<typeof cron.schedule>;
  running: boolean;
}

const jobs: JobDefinition[] = [
  {
    name:    'listenbrainz-fetch',
    cron:    JOB_INTERVALS.listenbrainz.cron,
    handler: listenbrainzFetchJob,
    running: false,
  },
  {
    name:    'catalog-discovery',
    cron:    JOB_INTERVALS.catalog.cron,
    handler: catalogDiscoveryJob,
    running: false,
  },
  {
    name:    'slskd-downloader',
    cron:    JOB_INTERVALS.slskd.cron,
    handler: slskdDownloaderJob,
    running: false,
  },
];

/**
 * Wrap job handler with overlap prevention and error handling
 */
function wrapJobHandler(job: JobDefinition): () => Promise<void> {
  return async() => {
    // Prevent overlapping execution
    if (job.running) {
      logger.warn(`Job ${ job.name } is still running, skipping this execution`);

      return;
    }

    job.running = true;
    const startTime = Date.now();

    try {
      logger.info(`Starting job: ${ job.name }`);
      await job.handler();
      const duration = Date.now() - startTime;

      logger.info(`Job ${ job.name } completed in ${ duration }ms`);
    } catch(error) {
      logger.error(`Job ${ job.name } failed:`, { error });
    } finally {
      job.running = false;
    }
  };
}

/**
 * Start all background jobs
 */
export function startJobs(): void {
  logger.info('Starting background jobs');

  for (const job of jobs) {
    // Validate cron expression
    if (!cron.validate(job.cron)) {
      logger.error(`Invalid cron expression for ${ job.name }: ${ job.cron }`);
      continue;
    }

    // Create wrapped handler
    const wrappedHandler = wrapJobHandler(job);

    // Schedule the job
    job.task = cron.schedule(job.cron, wrappedHandler);

    logger.info(`Scheduled job ${ job.name } with cron: ${ job.cron }`);

    // Run immediately on startup if configured
    if (RUN_ON_STARTUP) {
      logger.info(`Running ${ job.name } on startup`);
      // Run in background, don't wait
      wrappedHandler().catch((error) => {
        logger.error(`Startup execution of ${ job.name } failed:`, { error });
      });
    }
  }

  logger.info(`Started ${ jobs.length } background jobs`);
}

/**
 * Stop all background jobs
 */
export function stopJobs(): void {
  logger.info('Stopping background jobs');

  for (const job of jobs) {
    if (job.task) {
      job.task.stop();
      logger.info(`Stopped job: ${ job.name }`);
    }
  }

  logger.info('All background jobs stopped');
}

/**
 * Get job status information
 */
export function getJobStatus(): Array<{
  name:    string;
  cron:    string;
  running: boolean;
}> {
  return jobs.map((job) => ({
    name:    job.name,
    cron:    job.cron,
    running: job.running,
  }));
}
