import type { SlskdFile } from '@server/types/slskd-client';
import type { QualityInfo, QualityPreferences } from '@server/types/slskd';

import { describe, it, expect } from 'vitest';

import {
  detectFormat,
  isLosslessFormat,
  determineQualityTier,
  extractQualityInfo,
  calculateQualityScore,
  shouldRejectFile,
  exceedsLosslessCap,
  getDominantQualityInfo,
  calculateAverageQualityScore,
} from './audioQuality';

describe('audioQuality utilities', () => {
  describe('detectFormat', () => {
    it('detects flac format', () => {
      expect(detectFormat('/Music/Artist/Album/track.flac')).toBe('flac');
      expect(detectFormat('track.FLAC')).toBe('flac');
    });

    it('detects mp3 format', () => {
      expect(detectFormat('/Music/Artist/Album/track.mp3')).toBe('mp3');
    });

    it('detects wav format', () => {
      expect(detectFormat('track.wav')).toBe('wav');
    });

    it('detects alac format', () => {
      expect(detectFormat('track.alac')).toBe('alac');
    });

    it('detects aiff format', () => {
      expect(detectFormat('track.aiff')).toBe('aiff');
    });

    it('detects m4a format', () => {
      expect(detectFormat('track.m4a')).toBe('m4a');
    });

    it('detects ogg format', () => {
      expect(detectFormat('track.ogg')).toBe('ogg');
    });

    it('detects opus format', () => {
      expect(detectFormat('track.opus')).toBe('opus');
    });

    it('detects aac format', () => {
      expect(detectFormat('track.aac')).toBe('aac');
    });

    it('detects wma format', () => {
      expect(detectFormat('track.wma')).toBe('wma');
    });

    it('returns unknown for unrecognized formats', () => {
      expect(detectFormat('track.xyz')).toBe('unknown');
      expect(detectFormat('track')).toBe('unknown');
    });
  });

  describe('isLosslessFormat', () => {
    it('returns true for lossless formats', () => {
      expect(isLosslessFormat('flac')).toBe(true);
      expect(isLosslessFormat('wav')).toBe(true);
      expect(isLosslessFormat('alac')).toBe(true);
      expect(isLosslessFormat('aiff')).toBe(true);
    });

    it('returns false for lossy formats', () => {
      expect(isLosslessFormat('mp3')).toBe(false);
      expect(isLosslessFormat('m4a')).toBe(false);
      expect(isLosslessFormat('ogg')).toBe(false);
      expect(isLosslessFormat('opus')).toBe(false);
      expect(isLosslessFormat('aac')).toBe(false);
      expect(isLosslessFormat('wma')).toBe(false);
    });

    it('returns false for unknown format', () => {
      expect(isLosslessFormat('unknown')).toBe(false);
    });
  });

  describe('determineQualityTier', () => {
    it('returns lossless for lossless formats regardless of bitrate', () => {
      expect(determineQualityTier('flac', 1411, 16)).toBe('lossless');
      expect(determineQualityTier('wav', null, null)).toBe('lossless');
      expect(determineQualityTier('alac', 800, 24)).toBe('lossless');
    });

    it('returns high for 320+ kbps lossy', () => {
      expect(determineQualityTier('mp3', 320, null)).toBe('high');
      expect(determineQualityTier('mp3', 350, null)).toBe('high');
    });

    it('returns standard for 256-319 kbps lossy', () => {
      expect(determineQualityTier('mp3', 256, null)).toBe('standard');
      expect(determineQualityTier('mp3', 300, null)).toBe('standard');
      expect(determineQualityTier('mp3', 319, null)).toBe('standard');
    });

    it('returns low for 96-255 kbps lossy', () => {
      expect(determineQualityTier('mp3', 96, null)).toBe('low');
      expect(determineQualityTier('mp3', 128, null)).toBe('low');
      expect(determineQualityTier('mp3', 192, null)).toBe('low');
      expect(determineQualityTier('mp3', 255, null)).toBe('low');
    });

    it('returns low for below 96 kbps', () => {
      expect(determineQualityTier('mp3', 64, null)).toBe('low');
      expect(determineQualityTier('mp3', 32, null)).toBe('low');
    });

    it('returns unknown when bitrate is not available for lossy', () => {
      expect(determineQualityTier('mp3', null, null)).toBe('unknown');
      expect(determineQualityTier('mp3', undefined, undefined)).toBe('unknown');
      expect(determineQualityTier('mp3', 0, null)).toBe('unknown');
    });
  });

  describe('extractQualityInfo', () => {
    it('extracts quality info from flac file', () => {
      const file: SlskdFile = {
        filename:   'track.flac',
        size:       30000000,
        bitRate:    1411,
        bitDepth:   16,
        sampleRate: 44100,
      };

      const info = extractQualityInfo(file);

      expect(info).toEqual({
        format:     'flac',
        bitRate:    1411,
        bitDepth:   16,
        sampleRate: 44100,
        tier:       'lossless',
      });
    });

    it('extracts quality info from mp3 file', () => {
      const file: SlskdFile = {
        filename: 'track.mp3',
        size:     5000000,
        bitRate:  320,
      };

      const info = extractQualityInfo(file);

      expect(info).toEqual({
        format:     'mp3',
        bitRate:    320,
        bitDepth:   null,
        sampleRate: null,
        tier:       'high',
      });
    });

    it('handles file without metadata', () => {
      const file: SlskdFile = { filename: 'track.mp3' };

      const info = extractQualityInfo(file);

      expect(info).toEqual({
        format:     'mp3',
        bitRate:    null,
        bitDepth:   null,
        sampleRate: null,
        tier:       'unknown',
      });
    });
  });

  describe('calculateQualityScore', () => {
    const defaultPreferences: QualityPreferences = {
      enabled:               true,
      preferredFormats:      ['flac', 'wav', 'alac', 'mp3'],
      minBitrate:            256,
      preferLossless:        true,
      rejectLowQuality:      false,
      rejectLossless:        false,
      maxLosslessBitDepth:   0,
      maxLosslessSampleRate: 0,
      rejectHighResLossless: false,
    };

    it('returns 0 when preferences are disabled', () => {
      const info: QualityInfo = {
        format: 'flac', bitRate: 1411, bitDepth: 16, sampleRate: 44100, tier: 'lossless'
      };
      const disabled = { ...defaultPreferences, enabled: false };

      expect(calculateQualityScore(info, disabled)).toBe(0);
    });

    it('gives high score to lossless with preferLossless enabled', () => {
      const info: QualityInfo = {
        format: 'flac', bitRate: 1411, bitDepth: 16, sampleRate: 44100, tier: 'lossless'
      };

      const score = calculateQualityScore(info, defaultPreferences);

      // Base 1000 + preferred format 100 + prefer lossless 500 = 1600
      expect(score).toBe(1600);
    });

    it('gives bonus for preferred formats', () => {
      const infoMp3: QualityInfo = {
        format: 'mp3', bitRate: 320, bitDepth: null, sampleRate: null, tier: 'high'
      };
      const infoWma: QualityInfo = {
        format: 'wma', bitRate: 320, bitDepth: null, sampleRate: null, tier: 'high'
      };

      const scoreMp3 = calculateQualityScore(infoMp3, defaultPreferences);
      const scoreWma = calculateQualityScore(infoWma, defaultPreferences);

      // mp3 is preferred, wma is not
      expect(scoreMp3).toBeGreaterThan(scoreWma);
    });

    it('gives bonus for meeting minimum bitrate', () => {
      const info: QualityInfo = {
        format: 'mp3', bitRate: 320, bitDepth: null, sampleRate: null, tier: 'high'
      };

      const score = calculateQualityScore(info, defaultPreferences);

      // Base 500 + preferred format 100 + meets bitrate 50 = 650
      expect(score).toBe(650);
    });

    it('gives penalty for below minimum bitrate', () => {
      const info: QualityInfo = {
        format: 'mp3', bitRate: 128, bitDepth: null, sampleRate: null, tier: 'low'
      };

      const score = calculateQualityScore(info, defaultPreferences);

      // Base 50 + preferred format 100 - below bitrate 200 = -50
      expect(score).toBe(-50);
    });

    it('penalizes over-cap lossless below a compliant lossless file', () => {
      const capPrefs = {
        ...defaultPreferences,
        maxLosslessBitDepth:   16,
        maxLosslessSampleRate: 44100,
      };
      const compliant: QualityInfo = {
        format: 'flac', bitRate: 1411, bitDepth: 16, sampleRate: 44100, tier: 'lossless'
      };
      const overCap: QualityInfo = {
        format: 'flac', bitRate: 2304, bitDepth: 24, sampleRate: 96000, tier: 'lossless'
      };

      const compliantScore = calculateQualityScore(compliant, capPrefs);
      const overCapScore = calculateQualityScore(overCap, capPrefs);

      // Over-cap loses the 500 penalty regardless of the reject toggle
      expect(overCapScore).toBe(compliantScore - 500);
      expect(overCapScore).toBeLessThan(compliantScore);
    });
  });

  describe('shouldRejectFile', () => {
    const preferences: QualityPreferences = {
      enabled:               true,
      preferredFormats:      ['flac', 'mp3'],
      minBitrate:            256,
      preferLossless:        true,
      rejectLowQuality:      true,
      rejectLossless:        false,
      maxLosslessBitDepth:   0,
      maxLosslessSampleRate: 0,
      rejectHighResLossless: false,
    };

    it('returns false when preferences are disabled', () => {
      const info: QualityInfo = {
        format: 'mp3', bitRate: 64, bitDepth: null, sampleRate: null, tier: 'low'
      };
      const disabled = { ...preferences, enabled: false };

      expect(shouldRejectFile(info, disabled)).toBe(false);
    });

    it('returns false when rejectLowQuality is false', () => {
      const info: QualityInfo = {
        format: 'mp3', bitRate: 64, bitDepth: null, sampleRate: null, tier: 'low'
      };
      const noReject = { ...preferences, rejectLowQuality: false };

      expect(shouldRejectFile(info, noReject)).toBe(false);
    });

    it('does not reject lossless files when rejectLossless is false', () => {
      const info: QualityInfo = {
        format: 'flac', bitRate: 100, bitDepth: 16, sampleRate: 44100, tier: 'lossless'
      };

      expect(shouldRejectFile(info, preferences)).toBe(false);
    });

    it('rejects lossless files when rejectLossless is true', () => {
      const info: QualityInfo = {
        format: 'flac', bitRate: 1411, bitDepth: 16, sampleRate: 44100, tier: 'lossless'
      };
      const rejectLosslessPrefs = { ...preferences, rejectLossless: true };

      expect(shouldRejectFile(info, rejectLosslessPrefs)).toBe(true);
    });

    it('rejects lossless files even when rejectLowQuality is false if rejectLossless is true', () => {
      const info: QualityInfo = {
        format: 'flac', bitRate: 1411, bitDepth: 16, sampleRate: 44100, tier: 'lossless'
      };
      const rejectLosslessOnly = {
        ...preferences, rejectLowQuality: false, rejectLossless: true 
      };

      expect(shouldRejectFile(info, rejectLosslessOnly)).toBe(true);
    });

    it('rejects low tier files with bitrate info', () => {
      const info: QualityInfo = {
        format: 'mp3', bitRate: 128, bitDepth: null, sampleRate: null, tier: 'low'
      };

      expect(shouldRejectFile(info, preferences)).toBe(true);
    });

    it('rejects files below minimum bitrate', () => {
      const info: QualityInfo = {
        format: 'mp3', bitRate: 200, bitDepth: null, sampleRate: null, tier: 'standard'
      };
      const strictPrefs = { ...preferences, minBitrate: 256 };

      expect(shouldRejectFile(info, strictPrefs)).toBe(true);
    });

    it('does not reject files meeting minimum bitrate', () => {
      const info: QualityInfo = {
        format: 'mp3', bitRate: 320, bitDepth: null, sampleRate: null, tier: 'high'
      };

      expect(shouldRejectFile(info, preferences)).toBe(false);
    });

    describe('max lossless quality cap', () => {
      // 16-bit / 44.1 kHz cap with the hard-cutoff toggle enabled
      const capPrefs: QualityPreferences = {
        ...preferences,
        maxLosslessBitDepth:   16,
        maxLosslessSampleRate: 44100,
        rejectHighResLossless: true,
      };

      it('rejects over-cap lossless when rejectHighResLossless is true', () => {
        const info: QualityInfo = {
          format: 'flac', bitRate: 2304, bitDepth: 24, sampleRate: 96000, tier: 'lossless'
        };

        expect(shouldRejectFile(info, capPrefs)).toBe(true);
      });

      it('accepts at-or-under-cap lossless', () => {
        const info: QualityInfo = {
          format: 'flac', bitRate: 1411, bitDepth: 16, sampleRate: 44100, tier: 'lossless'
        };

        expect(shouldRejectFile(info, capPrefs)).toBe(false);
      });

      it('does not reject over-cap lossless when toggle is off (deprioritize only)', () => {
        const info: QualityInfo = {
          format: 'flac', bitRate: 2304, bitDepth: 24, sampleRate: 96000, tier: 'lossless'
        };
        const noToggle = { ...capPrefs, rejectHighResLossless: false };

        expect(shouldRejectFile(info, noToggle)).toBe(false);
      });

      it('never rejects on unknown bit depth / sample rate', () => {
        const info: QualityInfo = {
          format: 'flac', bitRate: null, bitDepth: null, sampleRate: null, tier: 'lossless'
        };

        expect(shouldRejectFile(info, capPrefs)).toBe(false);
      });

      it('enforces the cap independently of rejectLowQuality', () => {
        const info: QualityInfo = {
          format: 'flac', bitRate: 2304, bitDepth: 24, sampleRate: 96000, tier: 'lossless'
        };
        const noLowQuality = { ...capPrefs, rejectLowQuality: false };

        expect(shouldRejectFile(info, noLowQuality)).toBe(true);
      });
    });
  });

  describe('exceedsLosslessCap', () => {
    const capPrefs: QualityPreferences = {
      enabled:               true,
      preferredFormats:      ['flac'],
      minBitrate:            256,
      preferLossless:        true,
      rejectLowQuality:      false,
      rejectLossless:        false,
      maxLosslessBitDepth:   16,
      maxLosslessSampleRate: 44100,
      rejectHighResLossless: true,
    };

    it('returns true when bit depth or sample rate exceeds the cap', () => {
      const info: QualityInfo = {
        format: 'flac', bitRate: 2304, bitDepth: 24, sampleRate: 96000, tier: 'lossless'
      };

      expect(exceedsLosslessCap(info, capPrefs)).toBe(true);
    });

    it('returns false at the cap boundary', () => {
      const info: QualityInfo = {
        format: 'flac', bitRate: 1411, bitDepth: 16, sampleRate: 44100, tier: 'lossless'
      };

      expect(exceedsLosslessCap(info, capPrefs)).toBe(false);
    });

    it('returns false when metadata is unknown', () => {
      const info: QualityInfo = {
        format: 'flac', bitRate: null, bitDepth: null, sampleRate: null, tier: 'lossless'
      };

      expect(exceedsLosslessCap(info, capPrefs)).toBe(false);
    });

    it('returns false when caps are 0 (unlimited)', () => {
      const info: QualityInfo = {
        format: 'flac', bitRate: 2304, bitDepth: 24, sampleRate: 192000, tier: 'lossless'
      };
      const unlimited = {
        ...capPrefs, maxLosslessBitDepth: 0, maxLosslessSampleRate: 0 
      };

      expect(exceedsLosslessCap(info, unlimited)).toBe(false);
    });

    it('returns false for lossy files regardless of caps', () => {
      const info: QualityInfo = {
        format: 'mp3', bitRate: 320, bitDepth: null, sampleRate: 48000, tier: 'high'
      };

      expect(exceedsLosslessCap(info, capPrefs)).toBe(false);
    });
  });

  describe('getDominantQualityInfo', () => {
    it('returns null for empty file list', () => {
      expect(getDominantQualityInfo([])).toBe(null);
    });

    it('returns quality info for single file', () => {
      const files: SlskdFile[] = [
        {
          filename: 'track.flac', size: 30000000, bitRate: 1411, bitDepth: 16, sampleRate: 44100
        },
      ];

      const result = getDominantQualityInfo(files);

      expect(result).toEqual({
        format:     'flac',
        bitRate:    1411,
        bitDepth:   16,
        sampleRate: 44100,
        tier:       'lossless',
      });
    });

    it('returns most common format/tier combination', () => {
      const files: SlskdFile[] = [
        {
          filename: '01.flac', bitRate: 1411, bitDepth: 16, sampleRate: 44100
        },
        {
          filename: '02.flac', bitRate: 1411, bitDepth: 16, sampleRate: 44100
        },
        {
          filename: '03.flac', bitRate: 1411, bitDepth: 16, sampleRate: 44100
        },
        { filename: 'cover.mp3', bitRate: 128 },
      ];

      const result = getDominantQualityInfo(files);

      expect(result?.format).toBe('flac');
      expect(result?.tier).toBe('lossless');
    });

    it('calculates average bitrate for mp3 files', () => {
      const files: SlskdFile[] = [
        { filename: '01.mp3', bitRate: 320 },
        { filename: '02.mp3', bitRate: 320 },
        { filename: '03.mp3', bitRate: 256 },
      ];

      const result = getDominantQualityInfo(files);

      expect(result?.format).toBe('mp3');
      expect(result?.bitRate).toBe(299); // (320+320+256)/3 rounded
    });

    it('prefers higher quality tier on count ties', () => {
      const files: SlskdFile[] = [
        { filename: '01.flac', bitRate: 1411 },
        { filename: '01.mp3', bitRate: 320 },
      ];

      const result = getDominantQualityInfo(files);

      // Both have count 1, but lossless should win
      expect(result?.tier).toBe('lossless');
    });
  });

  describe('calculateAverageQualityScore', () => {
    const preferences: QualityPreferences = {
      enabled:               true,
      preferredFormats:      ['flac', 'mp3'],
      minBitrate:            256,
      preferLossless:        true,
      rejectLowQuality:      false,
      rejectLossless:        false,
      maxLosslessBitDepth:   0,
      maxLosslessSampleRate: 0,
      rejectHighResLossless: false,
    };

    it('returns 0 for empty file list', () => {
      expect(calculateAverageQualityScore([], preferences)).toBe(0);
    });

    it('returns 0 when preferences are disabled', () => {
      const files: SlskdFile[] = [{ filename: 'track.flac', bitRate: 1411 }];
      const disabled = { ...preferences, enabled: false };

      expect(calculateAverageQualityScore(files, disabled)).toBe(0);
    });

    it('calculates average score for multiple files', () => {
      const files: SlskdFile[] = [
        { filename: '01.flac', bitRate: 1411 },
        { filename: '02.flac', bitRate: 1411 },
      ];

      const score = calculateAverageQualityScore(files, preferences);

      // Each flac: 1000 + 100 + 500 = 1600
      expect(score).toBe(1600);
    });
  });
});
