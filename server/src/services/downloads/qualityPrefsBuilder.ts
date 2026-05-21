import type { QualityPreferences } from '@server/types/slskd';

import { DEFAULT_PREFERRED_FORMATS } from '@server/constants/slskd';

/**
 * Build a QualityPreferences object from config settings.
 * Returns undefined when no quality preferences are configured.
 */
export function buildQualityPreferences(
  configPrefs?: {
    enabled?:                  boolean;
    preferred_formats?:        string[];
    min_bitrate?:              number;
    prefer_lossless?:          boolean;
    reject_low_quality?:       boolean;
    reject_lossless?:          boolean;
    max_lossless_bit_depth?:   number;
    max_lossless_sample_rate?: number;
    reject_high_res_lossless?: boolean;
  }
): QualityPreferences | undefined {
  if (!configPrefs) {
    return undefined;
  }

  return {
    enabled:               configPrefs.enabled ?? true,
    preferredFormats:      configPrefs.preferred_formats ?? [...DEFAULT_PREFERRED_FORMATS],
    minBitrate:            configPrefs.min_bitrate ?? 256,
    preferLossless:        configPrefs.prefer_lossless ?? true,
    rejectLowQuality:      configPrefs.reject_low_quality ?? false,
    rejectLossless:        configPrefs.reject_lossless ?? false,
    maxLosslessBitDepth:   configPrefs.max_lossless_bit_depth ?? 0,
    maxLosslessSampleRate: configPrefs.max_lossless_sample_rate ?? 0,
    rejectHighResLossless: configPrefs.reject_high_res_lossless ?? false,
  };
}
