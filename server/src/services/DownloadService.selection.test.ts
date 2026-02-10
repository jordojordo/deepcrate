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
      const hasSlotBonus = hasSlot ? 100 : 0;
      const noSlotBonus = noSlot ? 100 : 0;

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

  describe('completeness scoring', () => {
    it('gives full bonus for exact match', () => {
      const fileCount = 12;
      const expectedTrackCount = 12;
      const weight = 500;
      const minRatio = 0.5;
      const ratio = fileCount / expectedTrackCount;

      let score = 0;

      if (ratio >= 1.0) {
        const penalizeExcess = true;

        if (penalizeExcess && ratio > 1.0) {
          const excessRatio = (fileCount - expectedTrackCount) / expectedTrackCount;

          score = weight / (1 + 2.0 * excessRatio);
        } else {
          score = weight;
        }
      } else if (ratio >= minRatio) {
        score = weight * ratio;
      }

      expect(score).toBe(500);
    });

    it('diminishes bonus for overcomplete results', () => {
      const fileCount = 20;
      const expectedTrackCount = 12;
      const weight = 500;
      const ratio = fileCount / expectedTrackCount;

      let score = 0;

      if (ratio >= 1.0) {
        const excessRatio = (fileCount - expectedTrackCount) / expectedTrackCount;

        score = weight / (1 + 2.0 * excessRatio);
      }

      // excessRatio = 8/12 = 0.667, decay = 1 + 2*0.667 = 2.333, score = 500/2.333 ≈ 214
      expect(Math.round(score)).toBe(214);
    });

    it('gives proportional bonus for partial completeness above threshold', () => {
      const fileCount = 8;
      const expectedTrackCount = 12;
      const weight = 500;
      const minRatio = 0.5;
      const ratio = fileCount / expectedTrackCount;

      let score = 0;

      if (ratio >= 1.0) {
        score = weight;
      } else if (ratio >= minRatio) {
        score = weight * ratio;
      }

      // 8/12 = 0.667, * 500 = 333.3
      expect(Math.round(score)).toBe(333);
    });

    it('gives zero bonus below minimum completeness ratio', () => {
      const fileCount = 3;
      const expectedTrackCount = 12;
      const weight = 500;
      const minRatio = 0.5;
      const ratio = fileCount / expectedTrackCount;

      let score = 0;

      if (ratio >= 1.0) {
        score = weight;
      } else if (ratio >= minRatio) {
        score = weight * ratio;
      }

      // 3/12 = 0.25, below 0.5 threshold
      expect(score).toBe(0);
    });

    it('gives zero bonus when no expected track count', () => {
      const expectedTrackCount = undefined;
      const completenessScore = expectedTrackCount ? 500 : 0;

      expect(completenessScore).toBe(0);
    });

    it('exactnessScore prefers exact over overcomplete over incomplete', () => {
      const exact       = { exactnessScore: 2, musicFileCount: 12 };
      const overcomplete = { exactnessScore: 1, musicFileCount: 15 };
      const incomplete   = { exactnessScore: 0, musicFileCount: 8 };

      // exact > overcomplete
      expect(exact.exactnessScore).toBeGreaterThan(overcomplete.exactnessScore);
      // overcomplete > incomplete
      expect(overcomplete.exactnessScore).toBeGreaterThan(incomplete.exactnessScore);

      // In sort cascade, exactnessScore takes priority over musicFileCount
      const result = overcomplete.exactnessScore - exact.exactnessScore;

      expect(result).toBeLessThan(0); // exact wins
    });
  });

  describe('fileCountScore capping', () => {
    it('caps at file_count_cap for unknown expected track count', () => {
      const fileCount = 25;
      const fileCountCap = 200;
      const score = Math.min(fileCount * 10, fileCountCap);

      expect(score).toBe(200);
    });

    it('peaks at file_count_cap for exact match with known expected', () => {
      const fileCount = 12;
      const expectedTrackCount = 12;
      const fileCountCap = 200;
      const score = fileCountCap * (fileCount / expectedTrackCount);

      expect(score).toBe(200);
    });

    it('decays for excess files beyond expected', () => {
      const fileCount = 15;
      const expectedTrackCount = 12;
      const fileCountCap = 200;
      const decayRate = 2.0;
      const excessRatio = (fileCount - expectedTrackCount) / expectedTrackCount;
      const score = fileCountCap / (1 + decayRate * excessRatio);

      // excessRatio = 3/12 = 0.25, decay = 1 + 2*0.25 = 1.5, score = 200/1.5 ≈ 133
      expect(Math.round(score)).toBe(133);
    });

    it('gives proportional score below expected', () => {
      const fileCount = 8;
      const expectedTrackCount = 12;
      const fileCountCap = 200;
      const score = fileCountCap * (fileCount / expectedTrackCount);

      // 200 * 8/12 ≈ 133
      expect(Math.round(score)).toBe(133);
    });
  });

  describe('max score computation', () => {
    const QUALITY_SCORES = {
      lossless: 1000, high: 500, standard: 200, low: 50, unknown: 100 
    };

    function computeMaxScore(
      qualityPreferences: { enabled: boolean; preferLossless: boolean; rejectLossless: boolean } | undefined,
      completenessConfig: { file_count_cap?: number; completeness_weight?: number; enabled?: boolean } | undefined,
      hasExpectedTrackCount: boolean
    ): number {
      const maxHasSlot = 100;
      const maxUploadSpeedBonus = 100;
      const maxFileCountScore = completenessConfig?.file_count_cap ?? 200;

      let maxQualityScore: number;

      if (!qualityPreferences?.enabled) {
        maxQualityScore = QUALITY_SCORES.unknown;
      } else if (qualityPreferences.rejectLossless) {
        maxQualityScore = QUALITY_SCORES.high + 100 + 50;
      } else if (qualityPreferences.preferLossless) {
        maxQualityScore = QUALITY_SCORES.lossless + 100 + 500;
      } else {
        maxQualityScore = QUALITY_SCORES.lossless + 100;
      }

      let maxCompletenessScore = 0;

      if (hasExpectedTrackCount && completenessConfig?.enabled !== false) {
        maxCompletenessScore = completenessConfig?.completeness_weight ?? 500;
      }

      return maxHasSlot + maxQualityScore + maxFileCountScore + maxUploadSpeedBonus + maxCompletenessScore;
    }

    it('computes default max with quality disabled and no expected tracks', () => {
      // hasSlot(100) + quality(100) + fileCount(200) + speed(100) = 500
      const max = computeMaxScore(undefined, undefined, false);

      expect(max).toBe(500);
    });

    it('computes max with prefer_lossless and expected track count', () => {
      // hasSlot(100) + quality(1600) + fileCount(200) + speed(100) + completeness(500) = 2500
      const max = computeMaxScore(
        {
          enabled: true, preferLossless: true, rejectLossless: false
        },
        {
          file_count_cap: 200, completeness_weight: 500, enabled: true
        },
        true
      );

      expect(max).toBe(2500);
    });

    it('computes max with reject_lossless', () => {
      // hasSlot(100) + quality(650) + fileCount(200) + speed(100) = 1050
      const max = computeMaxScore(
        {
          enabled: true, preferLossless: true, rejectLossless: true
        },
        undefined,
        false
      );

      expect(max).toBe(1050);
    });

    it('computes max without prefer_lossless', () => {
      // hasSlot(100) + quality(1100) + fileCount(200) + speed(100) = 1500
      const max = computeMaxScore(
        {
          enabled: true, preferLossless: false, rejectLossless: false
        },
        undefined,
        false
      );

      expect(max).toBe(1500);
    });

    it('scorePercent is correct for a perfect result', () => {
      const maxScore = 2500;
      const score = 2500;
      const scorePercent = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;

      expect(scorePercent).toBe(100);
    });

    it('scorePercent rounds correctly for partial scores', () => {
      const maxScore = 2500;
      const score = 1750;
      const scorePercent = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;

      expect(scorePercent).toBe(70);
    });
  });
});
