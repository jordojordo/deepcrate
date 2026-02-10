import type { ScoredSearchResponse, DirectoryGroup } from '@server/types/downloads';
import type { SlskdSearchResponse, SlskdFile } from '@server/types/slskd-client';
import type { QualityPreferences } from '@server/types/slskd';
import type { FileSizeConstraints } from '@server/services/downloads/musicFileFilter';

import path from 'path';

import {
  extractQualityInfo,
  getDominantQualityInfo,
  calculateAverageQualityScore,
  shouldRejectFile,
} from '@server/utils/audioQuality';
import { filterMusicFiles } from '@server/services/downloads/musicFileFilter';
import { QUALITY_SCORES } from '@server/constants/slskd';

export interface ScorerConfig {
  constraints:         FileSizeConstraints;
  qualityPreferences?: QualityPreferences;
  expectedTrackCount?: number;
  completenessConfig?: {
    file_count_cap?:         number;
    completeness_weight?:    number;
    enabled?:                boolean;
    min_completeness_ratio?: number;
    excess_decay_rate?:      number;
    penalize_excess?:        boolean;
    require_complete?:       boolean;
  };
}

/**
 * Compute the theoretical max score for the current config.
 */
export function computeMaxScore(
  qualityPreferences: QualityPreferences | undefined,
  completenessConfig: ScorerConfig['completenessConfig'],
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

/**
 * Group files by directory path.
 */
export function groupFilesByDirectory(files: SlskdFile[]): DirectoryGroup[] {
  const directoryMap = new Map<string, SlskdFile[]>();

  for (const file of files) {
    const dirPath = path.posix.dirname(file.filename.replace(/\\/g, '/'));
    const existing = directoryMap.get(dirPath) || [];

    existing.push(file);
    directoryMap.set(dirPath, existing);
  }

  return Array.from(directoryMap.entries()).map(([dirPath, dirFiles]) => ({
    path:        dirPath,
    files:       dirFiles,
    totalSize:   dirFiles.reduce((sum, f) => sum + (f.size || 0), 0),
    qualityInfo: getDominantQualityInfo(dirFiles),
  }));
}

/**
 * Score a single search response. Returns null if no valid music files.
 */
function scoreResponse(
  response: SlskdSearchResponse,
  config: ScorerConfig,
  maxScore: number
): ScoredSearchResponse | null {
  const {
    constraints, qualityPreferences, expectedTrackCount, completenessConfig
  } = config;

  let musicFiles = filterMusicFiles(response.files, constraints);

  if (qualityPreferences?.enabled && qualityPreferences.rejectLowQuality) {
    musicFiles = musicFiles.filter(f => {
      const qualityInfo = extractQualityInfo(f);

      return !shouldRejectFile(qualityInfo, qualityPreferences);
    });
  }

  if (musicFiles.length === 0) {
    return null;
  }

  const qualityScore = qualityPreferences?.enabled? calculateAverageQualityScore(musicFiles, qualityPreferences): QUALITY_SCORES.unknown;

  const hasSlot = response.hasFreeUploadSlot ? 100 : 0;
  const fileCountCap = completenessConfig?.file_count_cap ?? 200;
  let fileCountScore: number;

  if (expectedTrackCount && expectedTrackCount > 0) {
    if (musicFiles.length <= expectedTrackCount) {
      fileCountScore = fileCountCap * (musicFiles.length / expectedTrackCount);
    } else {
      const excessRatio = (musicFiles.length - expectedTrackCount) / expectedTrackCount;
      const decayRate = completenessConfig?.excess_decay_rate ?? 2.0;

      fileCountScore = fileCountCap / (1 + decayRate * excessRatio);
    }
  } else {
    fileCountScore = Math.min(musicFiles.length * 10, fileCountCap);
  }

  const uploadSpeedBonus = Math.min(response.uploadSpeed || 0, 1000000) / 10000;

  let completenessScore = 0;
  let completenessRatio: number | undefined;

  if (expectedTrackCount && expectedTrackCount > 0 && completenessConfig?.enabled !== false) {
    completenessRatio = musicFiles.length / expectedTrackCount;
    const weight = completenessConfig?.completeness_weight ?? 500;
    const minRatio = completenessConfig?.min_completeness_ratio ?? 0.5;

    if (completenessRatio >= 1.0) {
      const penalizeExcess = completenessConfig?.penalize_excess !== false;

      if (penalizeExcess && completenessRatio > 1.0) {
        const excessRatio = (musicFiles.length - expectedTrackCount) / expectedTrackCount;
        const decayRate = completenessConfig?.excess_decay_rate ?? 2.0;

        completenessScore = weight / (1 + decayRate * excessRatio);
      } else {
        completenessScore = weight;
      }
    } else if (completenessRatio >= minRatio) {
      completenessScore = weight * completenessRatio;
    }
  }

  const score = hasSlot + qualityScore + fileCountScore + uploadSpeedBonus + completenessScore;
  const scorePercent = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;

  return {
    response,
    score,
    scorePercent,
    scoreBreakdown: {
      hasSlot, qualityScore, fileCountScore, uploadSpeedBonus, completenessScore
    },
    musicFileCount: musicFiles.length,
    totalSize:      musicFiles.reduce((sum, f) => sum + (f.size || 0), 0),
    qualityInfo:    getDominantQualityInfo(musicFiles),
    directories:    groupFilesByDirectory(musicFiles),
    expectedTrackCount,
    completenessRatio,
  };
}

/**
 * Score, filter, and sort search responses for UI display.
 */
export function scoreSearchResponses(
  responses: SlskdSearchResponse[],
  skippedUsernames: string[],
  config: ScorerConfig
): ScoredSearchResponse[] {
  const { qualityPreferences, expectedTrackCount, completenessConfig } = config;
  const hasExpectedTrackCount = !!(expectedTrackCount && expectedTrackCount > 0);
  const maxScore = computeMaxScore(qualityPreferences, completenessConfig, hasExpectedTrackCount);

  const filteredUsers = responses.filter(response => !skippedUsernames.includes(response.username));
  const responseScores = filteredUsers.map(response => scoreResponse(response, config, maxScore));
  const filteredScores = responseScores.filter((scored): scored is ScoredSearchResponse => {
    if (!scored) {
      return false;
    }

    if (
      completenessConfig?.require_complete
      && expectedTrackCount
      && scored.musicFileCount < expectedTrackCount
    ) {
      return false;
    }

    return true;
  });

  return filteredScores.sort((a, b) => b.score - a.score);
}
