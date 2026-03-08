import { z } from 'zod';

import { registry } from '@server/openapi/registry';
import { security } from '@server/openapi/security';
import { errorResponseSchema } from '@server/types/responses';
import {
  GetSettingsResponseSchema,
  GetSectionResponseSchema,
  UpdateSectionResponseSchema,
  ValidateResponseSchema,
  SettingsSectionSchema,
} from '@server/types/settings';

registry.registerPath({
  method:    'get',
  path:      '/settings',
  tags:      ['Settings'],
  summary:   'Get all settings (secrets redacted)',
  security,
  responses: {
    200: {
      description: 'All settings',
      content:     { 'application/json': { schema: GetSettingsResponseSchema } },
    },
  },
});

registry.registerPath({
  method:    'get',
  path:      '/settings/{section}',
  tags:      ['Settings'],
  summary:   'Get settings for a specific section',
  security,
  request:   { params: z.object({ section: SettingsSectionSchema }) },
  responses: {
    200: {
      description: 'Section settings',
      content:     { 'application/json': { schema: GetSectionResponseSchema } },
    },
    404: {
      description: 'Section not found',
      content:     { 'application/json': { schema: errorResponseSchema } },
    },
  },
});

registry.registerPath({
  method:   'put',
  path:     '/settings/{section}',
  tags:     ['Settings'],
  summary:  'Update settings for a specific section',
  security,
  request: {
    params: z.object({ section: SettingsSectionSchema }),
    body:   { content: { 'application/json': { schema: z.record(z.string(), z.unknown()) } } },
  },
  responses: {
    200: {
      description: 'Section updated',
      content:     { 'application/json': { schema: UpdateSectionResponseSchema } },
    },
    400: {
      description: 'Validation error',
      content:     { 'application/json': { schema: errorResponseSchema } },
    },
    404: {
      description: 'Section not found',
      content:     { 'application/json': { schema: errorResponseSchema } },
    },
  },
});

registry.registerPath({
  method:   'post',
  path:     '/settings/validate',
  tags:     ['Settings'],
  summary:  'Validate settings data without saving',
  security,
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({
            section: SettingsSectionSchema,
            data:    z.record(z.string(), z.unknown()),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Validation result',
      content:     { 'application/json': { schema: ValidateResponseSchema } },
    },
    400: {
      description: 'Validation error',
      content:     { 'application/json': { schema: errorResponseSchema } },
    },
  },
});
