import { z } from 'zod';

/**
 * Job status schema
 */
export const jobStatusSchema = z.object({
  name:    z.string(),
  cron:    z.string(),
  running: z.boolean(),
  lastRun: z.string().nullable(),
});

export type JobStatus = z.infer<typeof jobStatusSchema>;

/**
 * Get all job statuses response schema
 */
export const jobStatusResponseSchema = z.object({ jobs: z.array(jobStatusSchema) });

export type JobStatusResponse = z.infer<typeof jobStatusResponseSchema>;

/**
 * Trigger job response schema
 */
export const triggerJobResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  jobName: z.string(),
});

export type TriggerJobResponse = z.infer<typeof triggerJobResponseSchema>;

/**
 * Cancel job response schema
 */
export const cancelJobResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  jobName: z.string(),
});

export type CancelJobResponse = z.infer<typeof cancelJobResponseSchema>;
