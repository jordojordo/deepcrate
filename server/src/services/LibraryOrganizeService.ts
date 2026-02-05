import fs from 'fs';
import path from 'path';
import { execFile as execFileCallback } from 'child_process';
import { promisify } from 'util';
import { Op } from '@sequelize/core';

import logger from '@server/config/logger';
import { getConfig } from '@server/config/settings';
import DownloadTask from '@server/models/DownloadTask';
import SubsonicClient from '@server/services/clients/SubsonicClient';
import { splitCommand } from '@server/utils/command';
import {
  joinDownloadsPath,
  normalizeBasePath,
  slskdDirectoryToRelativeDownloadPath,
  slskdPathBasename,
  toSafeRelativePath
} from '@server/utils/slskdPaths';

const execFile = promisify(execFileCallback);

export type OrganizePhase = 'finding_files' | 'running_beets' | 'transferring' | 'cleanup' | 'complete';

export interface OrganizeResult {
  status:           'organized' | 'skipped' | 'failed';
  message:          string;
  sourcePath?:      string;
  destinationPath?: string;
}

export interface OrganizeCallbacks {
  onTaskStart?:    (_task: DownloadTask) => void;
  onPhase?:        (_task: DownloadTask, _phase: OrganizePhase, _detail?: string) => void;
  onFileProgress?: (_task: DownloadTask, _current: number, _total: number, _filename: string) => void;
  onTaskComplete?: (_task: DownloadTask, _result: OrganizeResult) => void;
  isCancelled?:    () => boolean;
}

interface FoundDownload {
  sourcePath:    string;
  sourceDirName: string;
}

function normalizeName(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

function sanitizePathSegment(value: string): string {
  const sanitized = value
    .replace(/[/\\]/g, '-')
    .replace(/\0/g, '')
    .trim();

  return sanitized.length ? sanitized : 'Unknown';
}

async function pathExists(candidatePath: string): Promise<boolean> {
  try {
    await fs.promises.access(candidatePath, fs.constants.F_OK);

    return true;
  } catch {
    return false;
  }
}

async function listFilesRecursive(root: string): Promise<string[]> {
  const stat = await fs.promises.stat(root);

  if (stat.isFile()) {
    return [path.basename(root)];
  }

  const files: string[] = [];

  async function walk(currentDir: string, relBase: string): Promise<void> {
    const entries = await fs.promises.readdir(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      const abs = path.join(currentDir, entry.name);
      const rel = relBase ? path.join(relBase, entry.name) : entry.name;

      if (entry.isDirectory()) {
        await walk(abs, rel);
        continue;
      }

      if (entry.isFile()) {
        files.push(rel);
      }
    }
  }

  await walk(root, '');

  return files;
}

function sanitizeUsernameSegment(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const sanitized = value.replace(/[/\\]/g, '-').trim();

  return sanitized.length ? sanitized : null;
}

function endsWithSegments(haystack: string[], needle: string[]): boolean {
  if (needle.length === 0 || needle.length > haystack.length) {
    return false;
  }

  const offset = haystack.length - needle.length;

  for (let i = 0; i < needle.length; i++) {
    if (haystack[offset + i] !== needle[i]) {
      return false;
    }
  }

  return true;
}

export class LibraryOrganizeService {
  isConfigured(): boolean {
    const config = getConfig();
    const settings = config.library_organize;

    if (!settings?.enabled) {
      return false;
    }

    return Boolean(settings.downloads_path && settings.library_path);
  }

  async getUnorganizedTasks(): Promise<DownloadTask[]> {
    const where: Record<string, unknown> = {
      status:      'completed',
      organizedAt: null,
    };

    return DownloadTask.findAll({
      where,
      order: [['completedAt', 'ASC']],
    });
  }

  async backfillDownloadPaths(): Promise<number> {
    const config = getConfig();
    const organize = config.library_organize;

    if (!organize?.enabled || !organize.downloads_path) {
      return 0;
    }

    const where: Record<string, unknown> = {
      status:         'completed',
      organizedAt:    null,
      slskdDirectory: { [Op.ne]: null },
    };

    const tasks = await DownloadTask.findAll({
      where,
      order: [['completedAt', 'ASC']],
    });
    let updated = 0;

    for (const task of tasks) {
      const before = task.downloadPath ?? null;
      const found = await this.findDownloadedFiles(task);
      const after = task.downloadPath ?? null;

      if (found && after && after !== before) {
        updated++;
      }
    }

    return updated;
  }

  async getUnorganizedTasksPaginated(limit: number, offset: number): Promise<{ items: DownloadTask[]; total: number }> {
    const where: Record<string, unknown> = {
      status:      'completed',
      organizedAt: null,
    };

    const [items, total] = await Promise.all([
      DownloadTask.findAll({
        where,
        order: [['completedAt', 'ASC']],
        limit,
        offset,
      }),
      DownloadTask.count({ where }),
    ]);

    return { items, total };
  }

  async getOrganizeCounts(): Promise<{
    completed:   number;
    unorganized: number;
    organized:   number;
  }> {
    const unorganizedWhere: Record<string, unknown> = {
      status:      'completed',
      organizedAt: null,
    };

    const organizedWhere: Record<string, unknown> = {
      status:      'completed',
      organizedAt: {
        // Sequelize accepts { [Op.ne]: null }, but the TS types are overly strict for nullable dates.
        // Keeping this as an untyped where clause matches existing patterns in the codebase.
        [Op.ne]: null,
      },
    };

    const [completed, unorganized, organized] = await Promise.all([
      DownloadTask.count({ where: { status: 'completed' } }),
      DownloadTask.count({ where: unorganizedWhere }),
      DownloadTask.count({ where: organizedWhere }),
    ]);

    return {
      completed,
      unorganized,
      organized,
    };
  }

  private async listCandidates(downloadsPath: string, maxDepth = 3): Promise<Array<{
    absPath: string;
    name:    string;
    depth:   number;
    isDir:   boolean;
    isFile:  boolean;
  }>> {
    const candidates: Array<{ absPath: string; name: string; depth: number; isDir: boolean; isFile: boolean }> = [];

    async function walk(current: string, depth: number): Promise<void> {
      if (depth > maxDepth) {
        return;
      }

      let entries: fs.Dirent[] = [];

      try {
        entries = await fs.promises.readdir(current, { withFileTypes: true });
      } catch {
        return;
      }

      for (const entry of entries) {
        const absPath = path.join(current, entry.name);

        const isDir = entry.isDirectory();
        const isFile = entry.isFile();

        if (isDir || isFile) {
          candidates.push({
            absPath, name: entry.name, depth, isDir, isFile
          });
        }

        if (isDir) {
          await walk(absPath, depth + 1);
        }
      }
    }

    await walk(downloadsPath, 1);

    return candidates;
  }

  async findDownloadedFiles(task: DownloadTask): Promise<FoundDownload | null> {
    const config = getConfig();
    const settings = config.library_organize;

    if (!settings?.enabled || !settings.downloads_path) {
      return null;
    }

    const downloadsRoot = settings.downloads_path;
    const username = sanitizeUsernameSegment(task.slskdUsername);
    const slskdDirectoryRel = slskdDirectoryToRelativeDownloadPath(task.slskdDirectory);
    const slskdLeaf = slskdPathBasename(task.slskdDirectory);
    const expectedArtistAlbum = `${ task.artist } - ${ task.album }`;

    const candidateRelPaths = new Set<string>();

    const existingDownloadPath = toSafeRelativePath(task.downloadPath);

    if (existingDownloadPath) {
      candidateRelPaths.add(existingDownloadPath);
    }

    if (username && slskdDirectoryRel) {
      candidateRelPaths.add(`${ username }/${ slskdDirectoryRel }`);
    }

    if (username && slskdLeaf) {
      candidateRelPaths.add(`${ username }/${ slskdLeaf }`);
    }

    if (slskdDirectoryRel) {
      candidateRelPaths.add(slskdDirectoryRel);
    }

    if (slskdLeaf) {
      candidateRelPaths.add(slskdLeaf);
    }

    candidateRelPaths.add(expectedArtistAlbum);

    for (const candidate of candidateRelPaths) {
      const safeRel = toSafeRelativePath(candidate);

      if (!safeRel) {
        continue;
      }

      const absPath = joinDownloadsPath(downloadsRoot, safeRel);

      if (!(await pathExists(absPath))) {
        continue;
      }

      if (task.downloadPath !== safeRel) {
        await DownloadTask.update(
          { downloadPath: safeRel },
          { where: { id: task.id } }
        );

        task.downloadPath = safeRel;
      }

      const stat = await fs.promises.stat(absPath);
      const sourceDirName = stat.isFile() ? path.basename(path.dirname(absPath)) : path.basename(absPath);

      return { sourcePath: absPath, sourceDirName };
    }

    const normalizedExpected = normalizeName(expectedArtistAlbum);
    const normalizedArtist = normalizeName(task.artist);
    const normalizedAlbum = normalizeName(task.album);
    const normalizedLeaf = slskdLeaf ? normalizeName(slskdLeaf) : null;

    const normalizedSlskdSegments = slskdDirectoryRel ? slskdDirectoryRel.split('/').map((segment) => normalizeName(segment)).filter(Boolean) : null;

    const maxDepth = Math.min(
      10,
      Math.max(3, normalizedSlskdSegments ? normalizedSlskdSegments.length + 2 : 6),
    );


    const candidates = await this.listCandidates(downloadsRoot, maxDepth);
    let best: { score: number; depth: number; absPath: string; name: string; isDir: boolean } | null = null;

    for (const candidate of candidates) {
      const normalizedCandidate = normalizeName(candidate.name);
      const relPath = normalizeBasePath(path.relative(downloadsRoot, candidate.absPath));
      const relSegmentsNormalized = relPath.split('/').map((segment) => normalizeName(segment)).filter(Boolean);
      let score = 0;

      /*
       * Score tiers (descending priority):
       *   350 - Full slskd path match
       *   300 - Last 2 segments of slskd path match (e.g., Artist/Album)
       *   250 - Last 1 segment of slskd path match (e.g., Album)
       *   220 - Exact "Artist - Album" folder name match
       *   180 - Normalized name match (case/special char insensitive)
       *   160 - Directory with both artist AND album in path segments
       *   140 - Album name match OR slskd leaf segment match
       *   110 - Directory with album name somewhere in path
       *
       * Bonuses: +0-10 for shallower depth, +5 for directories
       */
      if (normalizedSlskdSegments && endsWithSegments(relSegmentsNormalized, normalizedSlskdSegments)) {
        score = 350;
      } else if (normalizedSlskdSegments && normalizedSlskdSegments.length >= 2 && endsWithSegments(relSegmentsNormalized, normalizedSlskdSegments.slice(-2))) {
        score = 300;
      } else if (normalizedSlskdSegments && normalizedSlskdSegments.length >= 1 && endsWithSegments(relSegmentsNormalized, normalizedSlskdSegments.slice(-1))) {
        score = 250;
      } else if (candidate.name === expectedArtistAlbum) {
        score = 220;
      } else if (normalizedCandidate === normalizedExpected) {
        score = 180;
      } else if (candidate.isDir && relSegmentsNormalized.includes(normalizedArtist) && relSegmentsNormalized.includes(normalizedAlbum)) {
        score = 160;
      } else if (normalizedCandidate === normalizedAlbum) {
        score = 140;
      } else if (normalizedLeaf && normalizedCandidate === normalizedLeaf) {
        score = 140;
      } else if (candidate.isDir && relSegmentsNormalized.includes(normalizedAlbum)) {
        score = 110;
      }

      if (score === 0) {
        continue;
      }

      if (candidate.isFile && score <= 100) {
        continue;
      }

      const depthBonus = Math.max(0, 10 - candidate.depth);
      const dirBonus = candidate.isDir ? 5 : 0;
      const totalScore = score + depthBonus + dirBonus;

      if (!best || totalScore > best.score) {
        best = {
          score:   totalScore,
          depth:   candidate.depth,
          absPath: candidate.absPath,
          name:    candidate.name,
          isDir:   candidate.isDir,
        };
      }
    }

    if (!best) {
      return null;
    }

    const bestRel = toSafeRelativePath(normalizeBasePath(path.relative(downloadsRoot, best.absPath)));

    if (bestRel && task.downloadPath !== bestRel) {
      await DownloadTask.update(
        { downloadPath: bestRel },
        { where: { id: task.id } }
      );
      task.downloadPath = bestRel;
    }

    const bestStat = await fs.promises.stat(best.absPath);
    const sourceDirName = bestStat.isFile() ? path.basename(path.dirname(best.absPath)) : path.basename(best.absPath);

    return {
      sourcePath: best.absPath,
      sourceDirName,
    };
  }

  computeDestinationPath(task: DownloadTask, sourceDirName: string): string {
    const config = getConfig();
    const settings = config.library_organize;

    if (!settings?.enabled || !settings.library_path) {
      throw new Error('library_organize is not configured');
    }

    if (settings.organization === 'flat') {
      return path.join(settings.library_path, sanitizePathSegment(sourceDirName));
    }

    return path.join(
      settings.library_path,
      sanitizePathSegment(task.artist),
      sanitizePathSegment(task.album),
    );
  }

  async runBeetsImport(importPath: string, callbacks?: OrganizeCallbacks, task?: DownloadTask): Promise<void> {
    const config = getConfig();
    const settings = config.library_organize;

    if (!settings?.enabled || !settings.beets?.enabled) {
      return;
    }

    if (callbacks?.isCancelled?.()) {
      throw new Error('Job cancelled');
    }

    if (task) {
      callbacks?.onPhase?.(task, 'running_beets', settings.beets.command);
    }

    let file = settings.beets.command;
    let args: string[] = [importPath];

    try {
      const commandParts = splitCommand(settings.beets.command);

      if (commandParts.length > 0) {
        file = commandParts[0];
        args = [...commandParts.slice(1), importPath];
      }

      const { stdout, stderr } = await execFile(file, args, {
        timeout:   5 * 60 * 1000,
        maxBuffer: 10 * 1024 * 1024,
      });

      if (stdout?.trim()) {
        logger.debug('[library-organize] beets stdout', { stdout: stdout.trim() });
      }

      if (stderr?.trim()) {
        logger.debug('[library-organize] beets stderr', { stderr: stderr.trim() });
      }
    } catch(error) {
      const message = error instanceof Error ? error.message : String(error);

      logger.warn('[library-organize] beets import failed', {
        error: message,
        importPath,
        file,
        args,
      });
    }
  }

  async moveToLibrary(source: string, destination: string, callbacks?: OrganizeCallbacks, task?: DownloadTask): Promise<void> {
    const config = getConfig();
    const settings = config.library_organize;

    if (!settings?.enabled) {
      throw new Error('library_organize is not configured');
    }

    if (callbacks?.isCancelled?.()) {
      throw new Error('Job cancelled');
    }

    if (await pathExists(destination)) {
      throw new Error(`Destination already exists: ${ destination }`);
    }

    const stat = await fs.promises.stat(source);

    if (stat.isDirectory()) {
      await fs.promises.mkdir(destination, { recursive: true });
      const files = await listFilesRecursive(source);

      let current = 0;

      for (const relFile of files) {
        if (callbacks?.isCancelled?.()) {
          throw new Error('Job cancelled');
        }

        current += 1;
        const srcFile = path.join(source, relFile);
        const dstFile = path.join(destination, relFile);

        await fs.promises.mkdir(path.dirname(dstFile), { recursive: true });
        await fs.promises.copyFile(srcFile, dstFile);

        if (task) {
          callbacks?.onFileProgress?.(task, current, files.length, relFile);
        }
      }

      if (settings.delete_after_move) {
        await fs.promises.rm(source, { recursive: true, force: true });
      }

      return;
    }

    if (stat.isFile()) {
      await fs.promises.mkdir(path.dirname(destination), { recursive: true });
      await fs.promises.copyFile(source, destination);

      if (task) {
        callbacks?.onFileProgress?.(task, 1, 1, path.basename(source));
      }

      if (settings.delete_after_move) {
        await fs.promises.unlink(source);
      }

      return;
    }

    throw new Error(`Unsupported source type: ${ source }`);
  }

  async triggerSubsonicRescan(): Promise<boolean> {
    const config = getConfig();
    const settings = config.library_organize;

    if (!settings?.enabled || !settings.subsonic_rescan) {
      return false;
    }

    const subsonic = config.catalog_discovery?.subsonic;

    if (!subsonic) {
      logger.warn('[library-organize] Subsonic server not configured, cannot rescan');

      return false;
    }

    const client = new SubsonicClient(subsonic.host, subsonic.username, subsonic.password);

    return client.startScan();
  }

  async organizeTask(task: DownloadTask, callbacks?: OrganizeCallbacks): Promise<OrganizeResult> {
    callbacks?.onTaskStart?.(task);

    try {
      const config = getConfig();
      const settings = config.library_organize;

      if (!settings?.enabled) {
        const result: OrganizeResult = { status: 'skipped', message: 'library_organize is disabled' };

        callbacks?.onTaskComplete?.(task, result);

        return result;
      }

      const expectedLabel = slskdPathBasename(task.slskdDirectory) ?? `${ task.artist } - ${ task.album }`;
      const downloadsPathLabel = settings.downloads_path ?? '(downloads_path not set)';

      callbacks?.onPhase?.(task, 'finding_files', `Looking for "${ expectedLabel }" in ${ downloadsPathLabel }`);

      const found = await this.findDownloadedFiles(task);

      if (!found) {
        const result: OrganizeResult = {
          status:  'skipped',
          message: `No matching files found for "${ expectedLabel }" in ${ downloadsPathLabel }`,
        };

        callbacks?.onTaskComplete?.(task, result);

        logger.debug('No matching files found', {
          taskId:          task.id,
          downloadPath:    task.downloadPath ?? null,
          slskdUsername:   task.slskdUsername ?? null,
          slskdDirectory:  task.slskdDirectory ?? null,
          expectedLabel,
          downloadsPathLabel,
        });

        return result;
      }

      const sourceStat = await fs.promises.stat(found.sourcePath);
      const baseDestination = this.computeDestinationPath(task, found.sourceDirName);
      const destinationPath = sourceStat.isFile() && settings.organization === 'artist_album'? path.join(baseDestination, path.basename(found.sourcePath)): baseDestination;

      if (await pathExists(destinationPath)) {
        await task.update({ organizedAt: new Date() });

        const result: OrganizeResult = {
          status:          'skipped',
          message:         `Destination already exists: ${ destinationPath }`,
          sourcePath:      found.sourcePath,
          destinationPath: destinationPath,
        };

        callbacks?.onTaskComplete?.(task, result);

        return result;
      }

      callbacks?.onPhase?.(task, 'transferring', destinationPath);

      await this.moveToLibrary(found.sourcePath, destinationPath, callbacks, task);

      const beetsImportPath = sourceStat.isFile()? path.dirname(destinationPath): destinationPath;

      await this.runBeetsImport(beetsImportPath, callbacks, task);

      callbacks?.onPhase?.(task, 'cleanup');

      await task.update({ organizedAt: new Date() });

      const result: OrganizeResult = {
        status:          'organized',
        message:         'Organized successfully',
        sourcePath:      found.sourcePath,
        destinationPath: destinationPath,
      };

      callbacks?.onPhase?.(task, 'complete');
      callbacks?.onTaskComplete?.(task, result);

      return result;
    } catch(error) {
      if (callbacks?.isCancelled?.()) {
        throw error;
      }

      const message = error instanceof Error ? error.message : String(error);
      const result: OrganizeResult = { status: 'failed', message };

      callbacks?.onTaskComplete?.(task, result);

      return result;
    }
  }

  async organizeAll(callbacks?: OrganizeCallbacks): Promise<OrganizeResult[]> {
    const tasks = await this.getUnorganizedTasks();
    const results: OrganizeResult[] = [];

    for (const task of tasks) {
      if (callbacks?.isCancelled?.()) {
        throw new Error('Job cancelled');
      }

      const result = await this.organizeTask(task, callbacks);

      results.push(result);
    }

    return results;
  }
}

export default LibraryOrganizeService;
