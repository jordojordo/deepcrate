/**
 * Audio quality detection and scoring utilities
 */

import type { SlskdFile } from '@server/types/slskd-client';
import type { AudioFormat, QualityInfo, QualityPreferences, QualityTier } from '@server/types/slskd';

import path from 'path';

import {
  LOSSLESS_FORMATS,
  HIGH_QUALITY_BITRATE,
  STANDARD_QUALITY_BITRATE,
  LOW_QUALITY_BITRATE,
  QUALITY_SCORES,
  QUALITY_TIER_ORDER,
  LOSSLESS_OVER_CAP_PENALTY,
} from '@server/constants/slskd';

/**
 * Map of file extensions to audio formats
 */
const EXTENSION_TO_FORMAT: Record<string, AudioFormat> = {
  '.flac': 'flac',
  '.wav':  'wav',
  '.alac': 'alac',
  '.aiff': 'aiff',
  '.mp3':  'mp3',
  '.m4a':  'm4a',
  '.aac':  'aac',
  '.ogg':  'ogg',
  '.opus': 'opus',
  '.wma':  'wma',
};

/**
 * Detect audio format from file extension
 */
export function detectFormat(filename: string): AudioFormat {
  const ext = path.extname(filename).toLowerCase();

  return EXTENSION_TO_FORMAT[ext] ?? 'unknown';
}

/**
 * Check if a format is lossless
 */
export function isLosslessFormat(format: AudioFormat): boolean {
  const ext = `.${ format }`;

  return LOSSLESS_FORMATS.includes(ext);
}

/**
 * Determine quality tier based on format and bitrate
 */
export function determineQualityTier(
  format: AudioFormat,
  bitRate: number | null | undefined,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _bitDepth: number | null | undefined,
): QualityTier {
  // Lossless formats are always lossless tier
  if (isLosslessFormat(format)) {
    return 'lossless';
  }

  // For lossy formats, use bitrate to determine tier
  if (bitRate === null || bitRate === undefined || bitRate === 0) {
    return 'unknown';
  }

  if (bitRate >= HIGH_QUALITY_BITRATE) {
    return 'high';
  }

  if (bitRate >= STANDARD_QUALITY_BITRATE) {
    return 'standard';
  }

  if (bitRate >= LOW_QUALITY_BITRATE) {
    return 'low';
  }

  // Below LOW_QUALITY_BITRATE is still "low" tier
  return 'low';
}

/**
 * Extract quality information from a slskd file
 */
export function extractQualityInfo(file: SlskdFile): QualityInfo {
  const format = detectFormat(file.filename);
  const bitRate = file.bitRate ?? null;
  const bitDepth = file.bitDepth ?? null;
  const sampleRate = file.sampleRate ?? null;
  const tier = determineQualityTier(format, bitRate, bitDepth);

  return {
    format,
    bitRate,
    bitDepth,
    sampleRate,
    tier,
  };
}

/**
 * Determine whether a lossless file exceeds the configured maximum lossless
 * quality cap (max bit depth and/or max sample rate). A cap of 0 means
 * unlimited. Files with unknown (null) bit depth or sample rate are given the
 * benefit of the doubt and never reported as exceeding the cap.
 */
export function exceedsLosslessCap(info: QualityInfo, preferences: QualityPreferences): boolean {
  if (info.tier !== 'lossless') {
    return false;
  }

  const { maxLosslessBitDepth, maxLosslessSampleRate } = preferences;

  if (maxLosslessBitDepth > 0 && info.bitDepth !== null && info.bitDepth > maxLosslessBitDepth) {
    return true;
  }

  if (maxLosslessSampleRate > 0 && info.sampleRate !== null && info.sampleRate > maxLosslessSampleRate) {
    return true;
  }

  return false;
}

/**
 * Calculate a quality score for a file based on preferences
 */
export function calculateQualityScore(info: QualityInfo, preferences: QualityPreferences): number {
  if (!preferences.enabled) {
    return 0;
  }

  let score = QUALITY_SCORES[info.tier] ?? QUALITY_SCORES.unknown;

  // Bonus for preferred formats
  if (preferences.preferredFormats.includes(info.format)) {
    score += 100;
  }

  // Bonus for lossless when prefer_lossless is enabled
  if (preferences.preferLossless && info.tier === 'lossless') {
    score += 500;
  }

  // Penalize lossless files exceeding the max lossless quality cap so they rank
  // below compliant files even when not hard-rejected (deprioritize behavior).
  if (exceedsLosslessCap(info, preferences)) {
    score -= LOSSLESS_OVER_CAP_PENALTY;
  }

  // Bonus/penalty based on bitrate relative to minBitrate
  if (info.bitRate !== null && info.tier !== 'lossless') {
    if (info.bitRate >= preferences.minBitrate) {
      // Bonus for meeting minimum bitrate
      score += 50;
    } else {
      // Penalty for being below minimum bitrate
      score -= 200;
    }
  }

  return score;
}

/**
 * Check if a file should be rejected based on quality preferences
 */
export function shouldRejectFile(info: QualityInfo, preferences: QualityPreferences): boolean {
  if (!preferences.enabled) {
    return false;
  }

  // Reject lossless files if rejectLossless is enabled
  if (preferences.rejectLossless && info.tier === 'lossless') {
    return true;
  }

  // Hard cutoff for lossless files exceeding the max lossless quality cap.
  // Independent of rejectLowQuality so it applies on its own toggle.
  if (preferences.rejectHighResLossless && exceedsLosslessCap(info, preferences)) {
    return true;
  }

  // Only apply low quality rejection if rejectLowQuality is enabled
  if (!preferences.rejectLowQuality) {
    return false;
  }

  // Don't reject lossless files for low quality (they're high quality by definition)
  if (info.tier === 'lossless') {
    return false;
  }

  // Reject if tier is low and we have bitrate info
  if (info.tier === 'low' && info.bitRate !== null) {
    return true;
  }

  // Reject if bitrate is below minimum (and we have bitrate info)
  if (info.bitRate !== null && info.bitRate < preferences.minBitrate) {
    return true;
  }

  return false;
}

/**
 * Get the dominant quality info from a set of files.
 * Returns the quality info that appears most frequently,
 * preferring higher quality tiers in case of ties.
 */
export function getDominantQualityInfo(files: SlskdFile[]): QualityInfo | null {
  if (files.length === 0) {
    return null;
  }

  const qualityInfos = files.map(extractQualityInfo);

  // Group by format and tier
  const grouped = new Map<string, { info: QualityInfo; count: number }>();

  for (const info of qualityInfos) {
    const key = `${ info.format }:${ info.tier }`;
    const existing = grouped.get(key);

    if (existing) {
      existing.count++;
      // Keep the info with bitrate data if available
      if (info.bitRate !== null && existing.info.bitRate === null) {
        existing.info = info;
      }
    } else {
      grouped.set(key, { info, count: 1 });
    }
  }

  // Sort by count descending, then by tier quality
  const sorted = Array.from(grouped.values()).sort((a, b) => {
    if (b.count !== a.count) {
      return b.count - a.count;
    }

    return QUALITY_TIER_ORDER.indexOf(a.info.tier) - QUALITY_TIER_ORDER.indexOf(b.info.tier);
  });

  const dominant = sorted[0];

  if (!dominant) {
    return null;
  }

  // Calculate average bitrate if we have bitrate data
  const sameFormatFiles = qualityInfos.filter((info) => info.format === dominant.info.format);
  const bitRates = sameFormatFiles.map((info) => info.bitRate).filter((br): br is number => br !== null);
  const avgBitRate = bitRates.length > 0 ? Math.round(bitRates.reduce((sum, br) => sum + br, 0) / bitRates.length) : null;

  // Get sample rate and bit depth from files that have them
  const sampleRates = sameFormatFiles.map((info) => info.sampleRate).filter((sr): sr is number => sr !== null);
  const bitDepths = sameFormatFiles.map((info) => info.bitDepth).filter((bd): bd is number => bd !== null);

  return {
    format:     dominant.info.format,
    bitRate:    avgBitRate,
    bitDepth:   bitDepths.length > 0 ? bitDepths[0] : null,
    sampleRate: sampleRates.length > 0 ? sampleRates[0] : null,
    tier:       dominant.info.tier,
  };
}

/**
 * Calculate average quality score for a set of files
 */
export function calculateAverageQualityScore(files: SlskdFile[], preferences: QualityPreferences): number {
  if (files.length === 0 || !preferences.enabled) {
    return 0;
  }

  const scores = files.map((file) => {
    const info = extractQualityInfo(file);

    return calculateQualityScore(info, preferences);
  });

  return Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length);
}
