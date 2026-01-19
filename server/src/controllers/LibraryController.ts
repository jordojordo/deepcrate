import type { Request, Response } from 'express';

import { BaseController } from '@server/controllers/BaseController';
import { getConfig, updateConfig } from '@server/config/settings';
import { LibraryService } from '@server/services/LibraryService';
import { LibraryOrganizeService } from '@server/services/LibraryOrganizeService';
import { triggerJob } from '@server/plugins/jobs';
import { JOB_NAMES } from '@server/constants/jobs';

function normalizePathInput(value: string): string {
  const trimmed = value.trim();

  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"'))
    || (trimmed.startsWith('\'') && trimmed.endsWith('\''))
  ) {
    return trimmed.slice(1, -1).trim();
  }

  return trimmed;
}

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

interface LibraryOrganizeConfigResponse {
  enabled:           boolean;
  downloads_path:    string | null;
  library_path:      string | null;
  organization:      'flat' | 'artist_album';
  interval:          number;
  auto_organize:     boolean;
  delete_after_move: boolean;
  navidrome_rescan:  boolean;
  beets:             { enabled: boolean; command: string };
}

interface UnorganizedTasksResponse {
  items: Array<{ id: string; artist: string; album: string; type: string; completedAt: string }>;
  total: number;
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

  /**
   * Get library organization config
   * GET /api/v1/library/organize/config
   */
  getOrganizeConfig = async(_req: Request, res: Response): Promise<Response> => {
    try {
      const config = getConfig();
      const organize = config.library_organize;

      const response: LibraryOrganizeConfigResponse = {
        enabled:           organize?.enabled ?? false,
        downloads_path:    organize?.downloads_path ?? null,
        library_path:      organize?.library_path ?? null,
        organization:      organize?.organization ?? 'artist_album',
        interval:          organize?.interval ?? 0,
        auto_organize:     organize?.auto_organize ?? false,
        delete_after_move: organize?.delete_after_move ?? true,
        navidrome_rescan:  organize?.navidrome_rescan ?? false,
        beets:             {
          enabled: organize?.beets?.enabled ?? false,
          command: organize?.beets?.command ?? 'beet import --quiet',
        },
      };

      return res.json(response);
    } catch(error) {
      return this.handleError(res, error as Error, 'Failed to fetch library organize config');
    }
  };

  /**
   * Update and persist library organization config
   * PUT /api/v1/library/organize/config
   */
  updateOrganizeConfig = async(req: Request, res: Response): Promise<Response> => {
    try {
      const body = (req.body ?? {}) as Partial<LibraryOrganizeConfigResponse>;

      const downloadsPath = typeof body.downloads_path === 'string' ? normalizePathInput(body.downloads_path) : undefined;
      const libraryPath = typeof body.library_path === 'string' ? normalizePathInput(body.library_path) : undefined;
      const beetsCommand = typeof body.beets?.command === 'string' ? body.beets.command.trim() : undefined;

      const updates: Record<string, unknown> = {
        enabled:           typeof body.enabled === 'boolean' ? body.enabled : undefined,
        downloads_path:    downloadsPath ? downloadsPath : undefined,
        library_path:      libraryPath ? libraryPath : undefined,
        organization:      body.organization,
        interval:          body.interval,
        auto_organize:     typeof body.auto_organize === 'boolean' ? body.auto_organize : undefined,
        delete_after_move: typeof body.delete_after_move === 'boolean' ? body.delete_after_move : undefined,
        navidrome_rescan:  typeof body.navidrome_rescan === 'boolean' ? body.navidrome_rescan : undefined,
        beets:             body.beets ? {
          enabled: typeof body.beets.enabled === 'boolean' ? body.beets.enabled : undefined,
          command: beetsCommand ? beetsCommand : undefined,
        } : undefined,
      };

      await updateConfig('library_organize', updates);

      const nextConfig = getConfig();
      const organize = nextConfig.library_organize;

      const response: LibraryOrganizeConfigResponse = {
        enabled:           organize?.enabled ?? false,
        downloads_path:    organize?.downloads_path ?? null,
        library_path:      organize?.library_path ?? null,
        organization:      organize?.organization ?? 'artist_album',
        interval:          organize?.interval ?? 0,
        auto_organize:     organize?.auto_organize ?? false,
        delete_after_move: organize?.delete_after_move ?? true,
        navidrome_rescan:  organize?.navidrome_rescan ?? false,
        beets:             {
          enabled: organize?.beets?.enabled ?? false,
          command: organize?.beets?.command ?? 'beet import --quiet',
        },
      };

      return res.json(response);
    } catch(error) {
      return this.handleError(res, error as Error, 'Failed to update library organize config');
    }
  };

  /**
   * List unorganized download tasks (paginated)
   * GET /api/v1/library/organize/tasks
   */
  getUnorganizedTasks = async(req: Request, res: Response): Promise<Response> => {
    try {
      const limit = Math.max(1, Math.min(100, Number(req.query.limit ?? 20) || 20));
      const offset = Math.max(0, Number(req.query.offset ?? 0) || 0);

      const { items, total } = await this.libraryOrganizeService.getUnorganizedTasksPaginated(limit, offset);

      const response: UnorganizedTasksResponse = {
        items: items.map((task) => ({
          id:          task.id,
          artist:      task.artist,
          album:       task.album,
          type:        task.type,
          completedAt: task.completedAt ? task.completedAt.toISOString() : '',
        })),
        total,
      };

      return res.json(response);
    } catch(error) {
      return this.handleError(res, error as Error, 'Failed to fetch unorganized tasks');
    }
  };
}

export default new LibraryController();
