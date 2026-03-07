/**
 * Standard security requirement: accepts any of bearer token, basic auth, or API key.
 * Applied to all protected endpoints.
 */
export const security: Record<string, string[]>[] = [
  { bearerAuth: [] },
  { basicAuth: [] },
  { apiKeyHeader: [] },
];
