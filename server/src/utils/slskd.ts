export function sanitizeUsernameSegment(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const sanitized = value.replace(/[/\\]/g, '-').trim();

  return sanitized.length ? sanitized : null;
}
