import type { SlskdFile } from '@server/types/slskd-client';

import path from 'path';

import { isMusicFile } from '@server/utils/fileHandler';
import { MB_TO_BYTES } from '@server/constants/slskd';

export interface FileSizeConstraints {
  minFileSizeBytes: number;
  maxFileSizeBytes: number;
}

/**
 * Extract file size constraints from search settings config.
 */
export function getFileSizeConstraints(
  searchSettings?: { min_file_size_mb?: number; max_file_size_mb?: number }
): FileSizeConstraints {
  return {
    minFileSizeBytes: (searchSettings?.min_file_size_mb ?? 1) * MB_TO_BYTES,
    maxFileSizeBytes: (searchSettings?.max_file_size_mb ?? 500) * MB_TO_BYTES,
  };
}

/**
 * Filter files to music files within size constraints,
 * optionally scoped to a specific directory.
 */
export function filterMusicFiles(
  files: SlskdFile[],
  constraints: FileSizeConstraints,
  directory?: string
): SlskdFile[] {
  const { minFileSizeBytes, maxFileSizeBytes } = constraints;

  return files.filter((f) => {
    if (!isMusicFile(f.filename)) {
      return false;
    }

    const size = f.size || 0;

    if (minFileSizeBytes > 0 && size < minFileSizeBytes) {
      return false;
    }

    if (maxFileSizeBytes > 0 && size > maxFileSizeBytes) {
      return false;
    }

    if (directory) {
      const fileDir = path.posix.dirname(f.filename.replace(/\\/g, '/'));

      return fileDir === directory || f.filename.replace(/\\/g, '/').startsWith(directory + '/');
    }

    return true;
  });
}
