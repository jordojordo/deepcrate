import path from 'path';

export function normalizeSlskdPath(value: string | null | undefined): string | null {
  if (value === undefined || value === null) {
    return null;
  }

  const normalized = value.replace(/\\/g, '/').replace(/\/+$/, '');

  return normalized === '.' ? '' : normalized;
}

function normalizeBasePath(value: string): string {
  const normalized = value.replace(/\\/g, '/').replace(/\/+$/, '');

  return normalized;
}

export function toSafeRelativePath(value: string | null | undefined): string | null {
  const normalized = normalizeSlskdPath(value);

  if (normalized === null) {
    return null;
  }

  const cleaned = normalized
    .replace(/^[a-zA-Z]:/, '')
    .replace(/^\/+/, '');

  const safeParts = cleaned
    .split('/')
    .map((part) => part.trim())
    .filter((part) => part.length > 0 && part !== '.' && part !== '..');

  if (safeParts.length === 0) {
    return null;
  }

  return safeParts.join('/');
}

export function slskdPathBasename(value: string | null | undefined): string | null {
  const relative = toSafeRelativePath(value);

  if (!relative) {
    return null;
  }

  const basename = path.posix.basename(relative);

  return basename || null;
}

export function slskdDirectoryToRelativeDownloadPath(
  directory: string | null | undefined,
  downloadsRoot?: string | null
): string | null {
  const normalized = normalizeSlskdPath(directory);

  if (normalized === null) {
    return null;
  }

  let relative = normalized;

  if (downloadsRoot) {
    const base = normalizeBasePath(downloadsRoot);

    if (base && (relative === base || relative.startsWith(`${ base }/`))) {
      relative = relative.slice(base.length).replace(/^\/+/, '');
    }
  }

  return toSafeRelativePath(relative);
}

export function joinDownloadsPath(downloadsRoot: string, relativePath: string): string {
  return path.join(downloadsRoot, ...relativePath.split('/'));
}
