import { describe, it, expect } from 'vitest';

import { buildQualityPreferences } from './qualityPrefsBuilder';

describe('buildQualityPreferences', () => {
  it('returns undefined when no config is provided', () => {
    expect(buildQualityPreferences()).toBeUndefined();
  });

  it('maps the lossless cap fields from config', () => {
    const prefs = buildQualityPreferences({
      enabled:                  true,
      max_lossless_bit_depth:   16,
      max_lossless_sample_rate: 44100,
      reject_high_res_lossless: true,
    });

    expect(prefs).toMatchObject({
      maxLosslessBitDepth:   16,
      maxLosslessSampleRate: 44100,
      rejectHighResLossless: true,
    });
  });

  it('defaults the lossless cap fields to unlimited / off when absent', () => {
    const prefs = buildQualityPreferences({ enabled: true });

    expect(prefs).toMatchObject({
      maxLosslessBitDepth:   0,
      maxLosslessSampleRate: 0,
      rejectHighResLossless: false,
    });
  });
});
