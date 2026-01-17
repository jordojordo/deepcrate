import type { Request, Response } from 'express';

import { BaseController } from '@server/controllers/BaseController';
import { getConfig } from '@server/config/settings';
import { LibraryService } from '@server/services/LibraryService';
import { LibraryOrganizeService } from '@server/services/LibraryOrganizeService';
import { triggerJob } from '@server/plugins/jobs';
import { JOB_NAMES } from '@server/constants/jobs';

interface LibraryStatsResponse {
  totalAlbums:  number;
  lastSyncedAt: string | null;
}

interface SyncResponse {
  success: boolean;
  message: string;
}

interface OrganizeStatusResponse {
  enabled:     boolean;
  configured:  boolean;
  completed:   number;
  unorganized: number;
  organized:   number;
}

/**
 * Library controller for managing library duplicate detection
 */
class LibraryController extends BaseController {
  private libraryService:         LibraryService;
  private libraryOrganizeService: LibraryOrganizeService;

  constructor() {
    super();
    this.libraryService = new LibraryService();
    this.libraryOrganizeService = new LibraryOrganizeService();
  }

  /**
   * Get library statistics
   * GET /api/v1/library/stats
   */
  getStats = async(_req: Request, res: Response): Promise<Response> => {
    try {
      const stats = await this.libraryService.getStats();

      const response: LibraryStatsResponse = {
        totalAlbums:  stats.totalAlbums,
        lastSyncedAt: stats.lastSyncedAt?.toISOString() || null,
      };

      return res.json(response);
    } catch(error) {
      return this.handleError(res, error as Error, 'Failed to fetch library stats');
    }
  };

  /**
   * Trigger manual library sync
   * POST /api/v1/library/sync
   */
  triggerSync = async(_req: Request, res: Response): Promise<Response> => {
    try {
      const result = triggerJob(JOB_NAMES.LIBRARY_SYNC);

      if (result === null) {
        const response: SyncResponse = {
          success: false,
          message: 'Library sync job not found',
        };

        return res.status(404).json(response);
      }

      if (result === false) {
        const response: SyncResponse = {
          success: false,
          message: 'Library sync is already running',
        };

        return res.status(409).json(response);
      }

      const response: SyncResponse = {
        success: true,
        message: 'Library sync started',
      };

      return res.json(response);
    } catch(error) {
      return this.handleError(res, error as Error, 'Failed to trigger library sync');
    }
  };

  /**
   * Trigger manual library organization
   * POST /api/v1/library/organize
   */
  triggerOrganize = async(_req: Request, res: Response): Promise<Response> => {
    try {
      const config = getConfig();

      if (!config.library_organize?.enabled) {
        return res.status(400).json({
          success: false,
          message: 'library_organize is disabled',
        });
      }

      if (!this.libraryOrganizeService.isConfigured()) {
        return res.status(400).json({
          success: false,
          message: 'library_organize is not configured',
        });
      }

      const result = triggerJob(JOB_NAMES.LIBRARY_ORGANIZE);

      if (result === null) {
        const response: SyncResponse = {
          success: false,
          message: 'Library organize job not found',
        };

        return res.status(404).json(response);
      }

      if (result === false) {
        const response: SyncResponse = {
          success: false,
          message: 'Library organize is already running',
        };

        return res.status(409).json(response);
      }

      const response: SyncResponse = {
        success: true,
        message: 'Library organize started',
      };

      return res.json(response);
    } catch(error) {
      return this.handleError(res, error as Error, 'Failed to trigger library organize');
    }
  };

  /**
   * Get library organization status
   * GET /api/v1/library/organize/status
   */
  getOrganizeStatus = async(_req: Request, res: Response): Promise<Response> => {
    try {
      const config = getConfig();
      const enabled = Boolean(config.library_organize?.enabled);
      const configured = this.libraryOrganizeService.isConfigured();

      const { completed, unorganized, organized } = await this.libraryOrganizeService.getOrganizeCounts();

      const response: OrganizeStatusResponse = {
        enabled,
        configured,
        completed,
        unorganized,
        organized,
      };

      return res.json(response);
    } catch(error) {
      return this.handleError(res, error as Error, 'Failed to fetch library organize status');
    }
  };
}

export default new LibraryController();
