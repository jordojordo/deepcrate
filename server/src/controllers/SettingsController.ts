import type { Request, Response } from 'express';
import type {
  GetSettingsResponse,
  GetSectionResponse,
  UpdateSectionResponse,
  ValidateResponse,
  SettingsSection,
} from '@server/types/settings';

import { BaseController } from '@server/controllers/BaseController';
import {
  getConfig,
  updateConfig,
  sanitizeConfigForApi,
  sanitizeSectionForApi,
  SECTION_SCHEMAS,
} from '@server/config/settings';
import {
  SETTINGS_SECTIONS,
  SettingsSectionSchema,
} from '@server/types/settings';
import { sendNotFoundError, sendValidationError } from '@server/utils/errorHandler';

/**
 * Settings controller for managing application configuration
 */
class SettingsController extends BaseController {
  /**
   * Get all settings (secrets sanitized)
   * GET /api/v1/settings
   */
  getAll = async(_req: Request, res: Response): Promise<Response> => {
    try {
      const config = getConfig();
      const sanitized = sanitizeConfigForApi(config);

      return res.json(sanitized as GetSettingsResponse);
    } catch(error) {
      return this.handleError(res, error as Error, 'Failed to fetch settings');
    }
  };

  /**
   * Get a single section
   * GET /api/v1/settings/:section
   */
  getSection = async(req: Request, res: Response): Promise<Response> => {
    try {
      const section = req.params.section as string;
      const parseResult = SettingsSectionSchema.safeParse(section);

      if (!parseResult.success) {
        return sendNotFoundError(res, `Unknown settings section: ${ section }`);
      }

      const config = getConfig();
      const sectionData = config[section as SettingsSection];

      if (sectionData === undefined) {
        const response: GetSectionResponse = {
          section,
          data: {},
        };

        return res.json(response);
      }

      const sanitized = sanitizeSectionForApi(
        section,
        sectionData as Record<string, unknown>
      );

      const response: GetSectionResponse = {
        section,
        data: sanitized,
      };

      return res.json(response);
    } catch(error) {
      return this.handleError(res, error as Error, 'Failed to fetch settings section');
    }
  };

  /**
   * Update a single section
   * PUT /api/v1/settings/:section
   */
  updateSection = async(req: Request, res: Response): Promise<Response> => {
    try {
      const section = req.params.section as string;
      const parseResult = SettingsSectionSchema.safeParse(section);

      if (!parseResult.success) {
        return sendNotFoundError(res, `Unknown settings section: ${ section }`);
      }

      const updates = req.body as Record<string, unknown>;

      if (!updates || typeof updates !== 'object') {
        return sendValidationError(res, 'Request body must be an object');
      }

      await updateConfig(section, updates);

      const response: UpdateSectionResponse = {
        success: true,
        message: `Settings section '${ section }' updated successfully`,
        section,
      };

      return res.json(response);
    } catch(error) {
      const err = error as Error;

      if (err.message.startsWith('Invalid configuration:')) {
        return sendValidationError(res, err.message);
      }

      return this.handleError(res, err, 'Failed to update settings');
    }
  };

  /**
   * Validate config without saving
   * POST /api/v1/settings/validate
   */
  validate = async(req: Request, res: Response): Promise<Response> => {
    try {
      const { section, data } = req.body as { section?: string; data?: unknown };

      if (!section || !SETTINGS_SECTIONS.includes(section as SettingsSection)) {
        return sendValidationError(res, `Invalid section: ${ section }`);
      }

      if (!data || typeof data !== 'object') {
        return sendValidationError(res, 'Request body must include a data object');
      }

      // TODO: Use request specific schemas as the frontend will pass partial updates
      //       with undefined fields for secret keys that are unchanged.

      const schema = SECTION_SCHEMAS[section];

      if (!schema) {
        return sendValidationError(res, `No validation schema for section: ${ section }`);
      }

      const result = schema.safeParse(data);

      if (!result.success) {
        const errors = result.error.issues.map((issue) => ({
          path:    issue.path.join('.'),
          message: issue.message,
        }));

        return res.json({ valid: false, errors } as ValidateResponse);
      }

      return res.json({ valid: true, errors: undefined } as ValidateResponse);
    } catch(error) {
      return this.handleError(res, error as Error, 'Failed to validate settings');
    }
  };
}

export default new SettingsController();
