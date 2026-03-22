/**
 * Custom error for HTTP request failures.
 * Thrown by httpClient when response is non-2xx.
 */
export class HttpError extends Error {
  constructor(
    message: string,
    public readonly status?: number, // eslint-disable-line no-unused-vars
    public readonly data?: unknown, // eslint-disable-line no-unused-vars
    public readonly code?: string, // eslint-disable-line no-unused-vars
  ) {
    super(message);
    this.name = 'HttpError';
  }
}
