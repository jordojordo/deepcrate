import type { DownloadProgress } from '@server/types/downloads';
import type { SlskdTransferFile, SlskdUserTransfers } from '@server/types/slskd-client';

import { normalizeSlskdPath } from '@server/utils/slskdPaths';

/**
 * Tokenize slskd state string into individual flags.
 * slskd returns transfer states as comma-separated enum flags
 * (e.g., "Completed, Succeeded" or "InProgress") rather than single values.
 */
function tokenizeSlskdState(value: unknown): string[] {
  if (typeof value !== 'string') {
    return [];
  }

  return value
    .split(',')
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean);
}

function summarizeTransferErrors(errorFiles: SlskdTransferFile[], totalFiles: number): string {
  const counts = errorFiles.reduce<Record<string, number>>((acc, file) => {
    const state = typeof file.state === 'string' ? file.state : String(file.state);
    const key = state || 'Unknown';

    acc[key] = (acc[key] || 0) + 1;

    return acc;
  }, {});

  const summary = Object.entries(counts)
    .map(([state, count]) => `${ count } ${ state }`)
    .join(', ');

  return `Download failed (${ summary }, ${ totalFiles } total files)`;
}

export function deriveTransferStatus(files: SlskdTransferFile[]): {
  status:        'queued' | 'downloading' | 'completed' | 'failed';
  errorMessage?: string;
} {
  const isQueued = (tokens: string[]) => tokens.includes('queued');
  const isCompleted = (tokens: string[]) => tokens.includes('completed') || tokens.includes('succeeded') || tokens.includes('success');
  const isErrored = (tokens: string[]) => tokens.includes('errored') || tokens.includes('error');
  const isCancelled = (tokens: string[]) => tokens.includes('cancelled') || tokens.includes('canceled');
  const isTimedOut = (tokens: string[]) => tokens.includes('timedout') || tokens.includes('timed out');
  const isErrorState = (tokens: string[]) => isErrored(tokens) || isCancelled(tokens) || isTimedOut(tokens);
  const isFinal = (tokens: string[]) => isCompleted(tokens) || isErrorState(tokens);

  let allQueued = true;
  let allCompleted = true;
  let allFinal = true;
  let allBytesTransferred = true;
  const errorFiles: SlskdTransferFile[] = [];

  for (const file of files) {
    const tokens = tokenizeSlskdState(file.state);

    if (!isQueued(tokens)) {
      allQueued = false;
    }

    if (!isCompleted(tokens)) {
      allCompleted = false;
    }

    if (!isFinal(tokens)) {
      allFinal = false;
    }

    if (isErrorState(tokens)) {
      errorFiles.push(file);
    }

    if (!Number.isFinite(file.size) || !Number.isFinite(file.bytesTransferred) || file.size > file.bytesTransferred) {
      allBytesTransferred = false;
    }
  }

  if (allCompleted || (allBytesTransferred && errorFiles.length === 0)) {
    return { status: 'completed' };
  }

  if (allFinal && errorFiles.length > 0) {
    return {
      status:       'failed',
      errorMessage: summarizeTransferErrors(errorFiles, files.length),
    };
  }

  if (allQueued) {
    return { status: 'queued' };
  }

  return { status: 'downloading' };
}

/**
 * Get transfer files for a task by matching directory path.
 */
export function getFilesForTask(taskDirectory: string, transfers: SlskdUserTransfers): SlskdTransferFile[] {
  const normalizedTaskDirectory = normalizeSlskdPath(taskDirectory);

  if (normalizedTaskDirectory === null) {
    return [];
  }

  const matchingDirectories = transfers.directories.filter((directory) => {
    const normalizedDirectory = normalizeSlskdPath(directory.directory);

    return normalizedDirectory === normalizedTaskDirectory;
  });

  return matchingDirectories.flatMap(directory => directory.files);
}

/**
 * Calculate download progress for a task from slskd transfers.
 */
export function calculateProgress(
  task: { status: string; slskdUsername?: string | null; slskdDirectory?: string | null },
  slskdTransfers: SlskdUserTransfers[]
): DownloadProgress | null {
  if (task.status !== 'downloading') {
    return null;
  }

  const userTransfers = slskdTransfers.find(t => t.username === task.slskdUsername);

  if (!userTransfers) {
    return null;
  }

  const taskDirectory = normalizeSlskdPath(task.slskdDirectory);

  if (taskDirectory === null) {
    return null;
  }

  const directory = userTransfers.directories.find(
    d => normalizeSlskdPath(d.directory) === taskDirectory
  );

  if (!directory) {
    return null;
  }

  const files = directory.files;
  const filesCompleted = files.filter(f => f.percentComplete >= 100).length;
  const filesTotal = files.length;
  const bytesTransferred = files.reduce((sum, f) => sum + f.bytesTransferred, 0);
  const bytesTotal = files.reduce((sum, f) => sum + f.size, 0);

  const activeFiles = files.filter(
    f => f.percentComplete > 0 && f.percentComplete < 100 && f.bytesRemaining > 0
  );
  const totalSpeed = activeFiles.reduce((sum, f) => sum + (f.averageSpeed || 0), 0);
  const averageSpeed = activeFiles.length > 0 ? totalSpeed : null;

  const totalBytesRemaining = activeFiles.reduce((sum, f) => sum + f.bytesRemaining, 0);
  let estimatedTimeRemaining: number | null = null;

  if (averageSpeed && totalBytesRemaining > 0) {
    estimatedTimeRemaining = Math.ceil(totalBytesRemaining / averageSpeed);
  }

  return {
    filesCompleted,
    filesTotal,
    bytesTransferred,
    bytesTotal,
    averageSpeed,
    estimatedTimeRemaining,
  };
}
