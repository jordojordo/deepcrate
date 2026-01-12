import type { Request, Response } from 'express';
import type { JobStatusResponse, TriggerJobResponse, CancelJobResponse } from '@server/types/jobs';

import { BaseController } from '@server/controllers/BaseController';
import { getJobStatus, triggerJob, cancelJob } from '@server/plugins/jobs';
import { sendNotFoundError, sendValidationError } from '@server/utils/errorHandler';

/**
 * Jobs controller for managing background job status and triggers
 */
class JobsController extends BaseController {
  /**
   * Get all job statuses
   * GET /api/v1/jobs/status
   */
  getStatus = async(_req: Request, res: Response): Promise<Response> => {
    try {
      const jobs = getJobStatus();

      const response: JobStatusResponse = { jobs };

      return res.json(response);
    } catch(error) {
      return this.handleError(res, error as Error, 'Failed to fetch job status');
    }
  };

  /**
   * Trigger a specific job by name
   * POST /api/v1/jobs/:jobName/trigger
   */
  trigger = async(req: Request, res: Response): Promise<Response> => {
    try {
      const jobName = req.params.jobName as string;

      if (!jobName) {
        return sendValidationError(res, 'Job name is required');
      }

      const result = triggerJob(jobName);

      if (result === null) {
        return sendNotFoundError(res, `Job '${ jobName }' not found`);
      }

      if (result === false) {
        const response: TriggerJobResponse = {
          success: false,
          message: `Job '${ jobName }' is already running`,
          jobName,
        };

        return res.status(409).json(response);
      }

      const response: TriggerJobResponse = {
        success: true,
        message: `Job '${ jobName }' triggered successfully`,
        jobName,
      };

      return res.json(response);
    } catch(error) {
      return this.handleError(res, error as Error, 'Failed to trigger job');
    }
  };

  /**
   * Cancel a running job by name
   * POST /api/v1/jobs/:jobName/cancel
   */
  cancel = async(req: Request, res: Response): Promise<Response> => {
    try {
      const jobName = req.params.jobName as string;

      if (!jobName) {
        return sendValidationError(res, 'Job name is required');
      }

      const result = await cancelJob(jobName);

      if (result === null) {
        return sendNotFoundError(res, `Job '${ jobName }' not found`);
      }

      if (result === false) {
        const response: CancelJobResponse = {
          success: false,
          message: `Job '${ jobName }' is not running`,
          jobName,
        };

        return res.status(409).json(response);
      }

      const response: CancelJobResponse = {
        success: true,
        message: `Job '${ jobName }' cancelled successfully`,
        jobName,
      };

      return res.json(response);
    } catch(error) {
      return this.handleError(res, error as Error, 'Failed to cancel job');
    }
  };
}

export default new JobsController();
