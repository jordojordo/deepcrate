import path from 'path';

import { MUSIC_EXTENSIONS } from '@server/constants/slskd';

/**
 * Check if a filename has a recognized music extension.
 */
export function isMusicFile(filename: string): boolean {
  const ext = path.extname(filename).toLowerCase();

  return MUSIC_EXTENSIONS.includes(ext);
}
