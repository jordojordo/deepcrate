import request from 'supertest';
import { describe, it, expect } from 'vitest';

import app from '@server/plugins/app';

describe('SettingsController', () => {
  describe('POST /api/v1/settings/validate', () => {
    it('returns valid: true for valid section data', async() => {
      const response = await request(app)
        .post('/api/v1/settings/validate')
        .send({
          section: 'listenbrainz',
          data:    {
            username:      'testuser',
            approval_mode: 'manual',
            source_type:   'weekly_playlist',
          },
        });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ valid: true, errors: undefined });
    });

    it('returns valid: false with errors for invalid data', async() => {
      const response = await request(app)
        .post('/api/v1/settings/validate')
        .send({
          section: 'listenbrainz',
          data:    {
            // invalid enum value should fail validation
            approval_mode: 'invalid_mode',
          },
        });

      expect(response.status).toBe(200);
      expect(response.body.valid).toBe(false);
      expect(response.body.errors).toBeInstanceOf(Array);
      expect(response.body.errors.length).toBeGreaterThan(0);
      expect(response.body.errors[0]).toHaveProperty('path');
      expect(response.body.errors[0]).toHaveProperty('message');
    });

    it('returns 400 for unknown section', async() => {
      const response = await request(app)
        .post('/api/v1/settings/validate')
        .send({
          section: 'nonexistent_section',
          data:    { foo: 'bar' },
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('Invalid section');
    });

    it('returns 400 for missing data', async() => {
      const response = await request(app)
        .post('/api/v1/settings/validate')
        .send({
          section: 'listenbrainz',
          // missing 'data' field
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('data object');
    });
  });
});
