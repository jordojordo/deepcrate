import type DownloadTask from '@server/models/DownloadTask';
import type { OrganizePhase, OrganizeResult } from '@server/services/LibraryOrganizeService';

import logger from '@server/config/logger';
import { JOB_NAMES } from '@server/constants/jobs';
import { getConfig } from '@server/config/settings';
import { isJobCancelled } from '@server/plugins/jobs';
import { emitJobProgress } from '@server/plugins/io/namespaces/jobsNamespace';
import { LibraryOrganizeService } from '@server/services/LibraryOrganizeService';

function formatTaskLabel(task: { artist: string; album: string }): string {
  return `${ task.artist } - ${ task.album }`;
}

export async function libraryOrganizeJob(): Promise<void> {
  const config = getConfig();
  const settings = config.library_organize;

  if (!settings?.enabled) {
    logger.debug('[library-organize] disabled, skipping');

    return;
  }

  const service = new LibraryOrganizeService();

  if (!service.isConfigured()) {
    logger.warn('[library-organize] not configured, skipping');

    return;
  }

  logger.info('[library-organize] starting');

  const backfilled = await service.backfillDownloadPaths();

  if (backfilled > 0) {
    logger.info('[library-organize] backfilled download paths', { count: backfilled });
  }

  const tasks = await service.getUnorganizedTasks();
  const totalTasks = tasks.length;
  const taskIndexById = new Map<string, number>(tasks.map((task, index) => [task.id, index + 1]));

  const callbacks = {
    isCancelled: () => isJobCancelled(JOB_NAMES.LIBRARY_ORGANIZE),
    onTaskStart: (task: DownloadTask) => {
      const index = taskIndexById.get(task.id) ?? 0;
      const label = formatTaskLabel({ artist: task.artist, album: task.album });

      emitJobProgress({
        name:    JOB_NAMES.LIBRARY_ORGANIZE,
        message: `Processing: ${ label } (${ index }/${ totalTasks })`,
        current: index,
        total:   totalTasks,
      });
    },
    onPhase: (task: DownloadTask, phase: OrganizePhase, detail?: string) => {
      const label = formatTaskLabel({ artist: task.artist, album: task.album });
      const messages: Record<OrganizePhase, string> = {
        finding_files: `Finding files: ${ label }`,
        running_beets: `Running beets import: ${ label }`,
        transferring:  `Transferring: ${ label }`,
        cleanup:       `Cleaning up source: ${ label }`,
        complete:      `Organized: ${ label }`,
      };

      emitJobProgress({
        name:    JOB_NAMES.LIBRARY_ORGANIZE,
        message: detail ? `${ messages[phase] } (${ detail })` : messages[phase],
      });
    },
    onFileProgress: (task: DownloadTask, current: number, total: number) => {
      const label = formatTaskLabel({ artist: task.artist, album: task.album });

      emitJobProgress({
        name:    JOB_NAMES.LIBRARY_ORGANIZE,
        message: `Transferring: ${ label } (${ current }/${ total } files)`,
        current,
        total,
      });
    },
    onTaskComplete: (task: DownloadTask, result: OrganizeResult) => {
      const label = formatTaskLabel({ artist: task.artist, album: task.album });
      const prefix = result.status === 'organized' ? 'Organized' : result.status === 'skipped' ? 'Skipped' : 'Failed';

      emitJobProgress({
        name:    JOB_NAMES.LIBRARY_ORGANIZE,
        message: result.message ? `${ prefix }: ${ label } — ${ result.message }` : `${ prefix }: ${ label }`,
      });
    },
  };

  try {
    if (isJobCancelled(JOB_NAMES.LIBRARY_ORGANIZE)) {
      logger.info('[library-organize] cancelled before start');
      throw new Error('Job cancelled');
    }

    for (const task of tasks) {
      if (isJobCancelled(JOB_NAMES.LIBRARY_ORGANIZE)) {
        logger.info('[library-organize] cancelled during run');
        throw new Error('Job cancelled');
      }

      await service.organizeTask(task, callbacks);
    }

    if (settings.subsonic_rescan) {
      if (isJobCancelled(JOB_NAMES.LIBRARY_ORGANIZE)) {
        logger.info('[library-organize] cancelled before Subsonic rescan');
        throw new Error('Job cancelled');
      }

      emitJobProgress({
        name:    JOB_NAMES.LIBRARY_ORGANIZE,
        message: 'Triggering Subsonic server library rescan',
      });

      await service.triggerSubsonicRescan();
    }

    logger.info('[library-organize] completed');
  } catch(error) {
    logger.error('[library-organize] failed:', { error });
    throw error;
  }
}
