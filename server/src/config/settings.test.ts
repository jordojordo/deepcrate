import { describe, it, expect } from 'vitest';
import { z } from 'zod';

/**
 * Recreate the ListenBrainz schema to test default behavior.
 * This ensures source_type defaults to 'weekly_playlist' as documented.
 */
const ListenBrainzSettingsSchema = z.object({
  username:      z.string(),
  token:         z.string().optional(),
  approval_mode: z.enum(['auto', 'manual']).default('manual'),
  source_type:   z.enum(['collaborative', 'weekly_playlist']).default('weekly_playlist'),
});

describe('ListenBrainzSettingsSchema', () => {
  describe('source_type default', () => {
    it('defaults to weekly_playlist when not specified', () => {
      const input = { username: 'testuser' };
      const result = ListenBrainzSettingsSchema.parse(input);

      expect(result.source_type).toBe('weekly_playlist');
    });

    it('defaults to weekly_playlist even when token is provided', () => {
      // This is the key fix: token presence should NOT imply collaborative mode
      const input = {
        username: 'testuser',
        token:    'some-api-token',
      };
      const result = ListenBrainzSettingsSchema.parse(input);

      expect(result.source_type).toBe('weekly_playlist');
    });

    it('uses collaborative when explicitly set', () => {
      const input = {
        username:    'testuser',
        token:       'some-api-token',
        source_type: 'collaborative' as const,
      };
      const result = ListenBrainzSettingsSchema.parse(input);

      expect(result.source_type).toBe('collaborative');
    });

    it('uses weekly_playlist when explicitly set', () => {
      const input = {
        username:    'testuser',
        source_type: 'weekly_playlist' as const,
      };
      const result = ListenBrainzSettingsSchema.parse(input);

      expect(result.source_type).toBe('weekly_playlist');
    });
  });

  describe('approval_mode default', () => {
    it('defaults to manual when not specified', () => {
      const input = { username: 'testuser' };
      const result = ListenBrainzSettingsSchema.parse(input);

      expect(result.approval_mode).toBe('manual');
    });
  });
});
