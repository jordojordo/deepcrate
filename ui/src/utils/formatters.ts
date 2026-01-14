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
