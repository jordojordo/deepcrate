import * as cron from 'node-cron';

import logger from '@server/config/logger';
import { JOB_NAMES } from '@server/constants/jobs';
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
  lastRun: Date | null;
  aborted: boolean;
}

const jobs: JobDefinition[] = [
  {
    name:    JOB_NAMES.LB_FETCH,
    cron:    JOB_INTERVALS.listenbrainz.cron,
    handler: listenbrainzFetchJob,
    running: false,
    lastRun: null,
    aborted: false,
  },
  {
    name:    JOB_NAMES.CATALOGD,
    cron:    JOB_INTERVALS.catalog.cron,
    handler: catalogDiscoveryJob,
    running: false,
    lastRun: null,
    aborted: false,
  },
  {
    name:    JOB_NAMES.SLSKD,
    cron:    JOB_INTERVALS.slskd.cron,
    handler: slskdDownloaderJob,
    running: false,
    lastRun: null,
    aborted: false,
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
    job.aborted = false;
    job.lastRun = new Date();
    logger.debug(`Job ${ job.name } running state set to true`);
    const startTime = Date.now();

    try {
      logger.info(`Starting job: ${ job.name }`);
      await job.handler();
      const duration = Date.now() - startTime;

      if (job.aborted) {
        logger.info(`Job ${ job.name } was cancelled after ${ duration }ms`);
      } else {
        logger.info(`Job ${ job.name } completed in ${ duration }ms`);
      }
    } catch(error) {
      if (job.aborted) {
        logger.info(`Job ${ job.name } cancelled:`, { error });
      } else {
        logger.error(`Job ${ job.name } failed:`, { error });
      }
    } finally {
      job.running = false;
      job.aborted = false;
      logger.debug(`Job ${ job.name } running state set to false`);
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
  lastRun: string | null;
}> {
  return jobs.map((job) => ({
    name:    job.name,
    cron:    job.cron,
    running: job.running,
    lastRun: job.lastRun ? job.lastRun.toISOString() : null,
  }));
}

/**
 * Trigger a job manually by name
 * @param name - The name of the job to trigger
 * @returns true if triggered, false if already running, null if not found
 */
export function triggerJob(name: string): boolean | null {
  const job = jobs.find((j) => j.name === name);

  if (!job) {
    logger.warn(`Attempt to trigger unknown job: ${ name }`);

    return null;
  }

  if (job.running) {
    logger.warn(`Job ${ name } is already running (running=${ job.running }), cannot trigger`);

    return false;
  }

  logger.info(`Triggering job ${ name } manually (current running=${ job.running })`);

  // Run the job asynchronously (don't await)
  const wrappedHandler = wrapJobHandler(job);

  wrappedHandler().catch((error) => {
    logger.error(`Manual trigger of ${ name } failed:`, { error });
  });

  logger.info(`Manually triggered job: ${ name }`);

  return true;
}

/**
 * Cancel a running job by name and wait for it to stop
 * @param name - The name of the job to cancel
 * @param timeout - Maximum time to wait for job to stop (default 30s)
 * @returns true if cancelled, false if not running, null if not found
 */
export async function cancelJob(name: string, timeout = 30000): Promise<boolean | null> {
  const job = jobs.find((j) => j.name === name);

  if (!job) {
    logger.warn(`Attempt to cancel unknown job: ${ name }`);

    return null;
  }

  if (!job.running) {
    logger.warn(`Job ${ name } is not running, cannot cancel`);

    return false;
  }

  logger.info(`Cancelling job ${ name }`);
  job.aborted = true;

  // Wait for the job to actually stop
  const pollInterval = 100;
  const startTime = Date.now();

  while (job.running) {
    if (Date.now() - startTime > timeout) {
      logger.warn(`Timeout waiting for job ${ name } to stop`);

      return true; // Still return true - cancellation was requested
    }

    await new Promise((resolve) => setTimeout(resolve, pollInterval));
  }

  logger.info(`Job ${ name } has stopped`);

  return true;
}

/**
 * Check if a job has been cancelled
 * @param name - The name of the job to check
 * @returns true if the job is marked for cancellation
 */
export function isJobCancelled(name: string): boolean {
  const job = jobs.find((j) => j.name === name);

  return job?.aborted ?? false;
}
