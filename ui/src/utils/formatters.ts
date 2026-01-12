export function formatDate(date: string): string {
  return new Date(date).toLocaleDateString()
}

export function formatScore(score: number | undefined): string {
  return score !== undefined ? score.toFixed(1) : 'N/A'
}

export function truncate(text: string, length: number): string {
  return text.length > length ? `${text.slice(0, length)}...` : text
}
