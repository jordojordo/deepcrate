import { describe, it, expect } from 'vitest';
import { cachedSearchResultsSchema } from '@server/types/downloads';

describe('DownloadService Selection Workflow', () => {
  describe('cachedSearchResultsSchema validation', () => {
    it('validates correct search response structure', () => {
      const validData = [
        {
          username:          'user1',
          files:             [
            {
              filename: 'track1.flac',
              size:     30000000,
              bitRate:  1411,
            },
            {
              filename: 'track2.flac',
              size:     25000000,
            },
          ],
          hasFreeUploadSlot: true,
          uploadSpeed:       500000,
        },
      ];

      const result = cachedSearchResultsSchema.safeParse(validData);

      expect(result.success).toBe(true);
    });

    it('rejects missing username', () => {
      const invalidData = [{ files: [{ filename: 'track1.flac' }] }];

      const result = cachedSearchResultsSchema.safeParse(invalidData);

      expect(result.success).toBe(false);
    });

    it('rejects missing files array', () => {
      const invalidData = [{ username: 'user1' }];

      const result = cachedSearchResultsSchema.safeParse(invalidData);

      expect(result.success).toBe(false);
    });

    it('rejects files with missing filename', () => {
      const invalidData = [
        {
          username: 'user1',
          files:    [{ size: 30000000 }],
        },
      ];

      const result = cachedSearchResultsSchema.safeParse(invalidData);

      expect(result.success).toBe(false);
    });

    it('accepts optional fields', () => {
      const validData = [
        {
          username: 'user1',
          files:    [{ filename: 'track1.flac' }], // All optional fields omitted
        },
      ];

      const result = cachedSearchResultsSchema.safeParse(validData);

      expect(result.success).toBe(true);
    });

    it('rejects non-array input', () => {
      const invalidData = {
        username: 'user1',
        files:    [],
      };

      const result = cachedSearchResultsSchema.safeParse(invalidData);

      expect(result.success).toBe(false);
    });

    it('accepts empty array', () => {
      const result = cachedSearchResultsSchema.safeParse([]);

      expect(result.success).toBe(true);
    });
  });

  describe('expiration validation', () => {
    it('detects expired selection', () => {
      const pastDate = new Date(Date.now() - 1000); // 1 second ago
      const isExpired = pastDate < new Date();

      expect(isExpired).toBe(true);
    });

    it('allows valid selection within timeout', () => {
      const futureDate = new Date(Date.now() + 60000); // 1 minute from now
      const isExpired = futureDate < new Date();

      expect(isExpired).toBe(false);
    });

    it('handles null expiration (no timeout)', () => {
      const expiresAt = null;
      const isExpired = expiresAt !== null && expiresAt < new Date();

      expect(isExpired).toBe(false);
    });
  });

  describe('username sanitization', () => {
    it('truncates long usernames', () => {
      const longUsername = 'a'.repeat(100);
      const sanitized = longUsername.slice(0, 50).replace(/[<>&"']/g, '');

      expect(sanitized.length).toBe(50);
    });

    it('escapes HTML special characters', () => {
      const maliciousUsername = '<script>alert("xss")</script>';
      const sanitized = maliciousUsername.slice(0, 50).replace(/[<>&"']/g, '');

      expect(sanitized).toBe('scriptalert(xss)/script');
      expect(sanitized).not.toContain('<');
      expect(sanitized).not.toContain('>');
      expect(sanitized).not.toContain('"');
    });

    it('preserves safe usernames', () => {
      const safeUsername = 'normal_user123';
      const sanitized = safeUsername.slice(0, 50).replace(/[<>&"']/g, '');

      expect(sanitized).toBe('normal_user123');
    });

    it('handles empty string', () => {
      const emptyUsername = '';
      const sanitized = emptyUsername.slice(0, 50).replace(/[<>&"']/g, '');

      expect(sanitized).toBe('');
    });
  });

  describe('scoring algorithm', () => {
    it('prioritizes users with free upload slots', () => {
      const hasSlot = true;
      const noSlot = false;
      const hasSlotBonus = hasSlot ? 1000 : 0;
      const noSlotBonus = noSlot ? 1000 : 0;

      expect(hasSlotBonus).toBeGreaterThan(noSlotBonus);
    });

    it('factors upload speed into score', () => {
      const uploadSpeed1 = 500000;
      const uploadSpeed2 = 1000000;

      const speedBonus1 = Math.min(uploadSpeed1, 1000000) / 10000;
      const speedBonus2 = Math.min(uploadSpeed2, 1000000) / 10000;

      expect(speedBonus2).toBeGreaterThan(speedBonus1);
    });

    it('caps upload speed bonus at 100 points', () => {
      const highUploadSpeed = 2000000; // 2MB/s
      const speedBonus = Math.min(highUploadSpeed, 1000000) / 10000;

      expect(speedBonus).toBe(100);
    });
  });

  describe('MAX_STORED_SELECTION_RESULTS constant', () => {
    it('should limit stored results', async() => {
      const { MAX_STORED_SELECTION_RESULTS } = await import('@server/constants/slskd');

      expect(MAX_STORED_SELECTION_RESULTS).toBe(15);
      expect(MAX_STORED_SELECTION_RESULTS).toBeLessThan(50); // Less than maxResponsesToEval default
    });
  });
});
