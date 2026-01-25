export function formatDate(date: string): string {
  return new Date(date).toLocaleDateString();
}

export function formatScore(score: number | undefined): string {
  return score !== undefined ? score.toFixed(1) : 'N/A';
}

export function truncate(text: string, length: number): string {
  return text.length > length ? `${ text.slice(0, length) }...` : text;
}

export function formatRelativeTime(date: string): string {
  const now = new Date();
  const then = new Date(date);
  const diffMs = now.getTime() - then.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) {
    return 'just now';
  } else if (diffMin < 60) {
    return `${ diffMin }m ago`;
  } else if (diffHour < 24) {
    return `${ diffHour }h ago`;
  } else if (diffDay < 7) {
    return `${ diffDay }d ago`;
  } else {
    return formatDate(date);
  }
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) {
    return '0 B';
  }

  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${ parseFloat((bytes / Math.pow(k, i)).toFixed(2)) } ${ sizes[i] }`;
}

// Alias for formatBytes for file size display
export const formatFileSize = formatBytes;

export function formatSpeed(bytesPerSecond: number | null): string {
  if (!bytesPerSecond) {
    return 'N/A';
  }

  return `${ formatBytes(bytesPerSecond) }/s`;
}

export function formatDuration(seconds: number | null): string {
  if (!seconds) {
    return 'N/A';
  }
  if (seconds < 60) {
    return `${ Math.round(seconds) }s`;
  }
  if (seconds < 3600) {
    return `${ Math.round(seconds / 60) }m`;
  }

  return `${ Math.round(seconds / 3600) }h`;
}

export function getDefaultCoverUrl(): string {
  return 'data:image/svg+xml,' + encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" fill="none">
      <rect width="200" height="200" />
      <circle cx="100" cy="100" r="50" stroke="#3b3b54" stroke-width="4" fill="none"/>
      <circle cx="100" cy="100" r="20" fill="#3b3b54"/>
    </svg>
  `);
}
