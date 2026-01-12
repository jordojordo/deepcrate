export function isValidMbid(mbid: string): boolean {
  const mbidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  return mbidRegex.test(mbid)
}
