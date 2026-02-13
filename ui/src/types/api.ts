export interface PaginatedResponse<T> {
  items:  T[];
  total:  number;
  limit:  number;
  offset: number;
}

/**
 * Error codes returned by the API
 *
 * - `internal_error` - Unexpected server error (500)
 * - `validation_error` - Invalid request data (400)
 * - `not_found` - Resource not found (404)
 * - `unauthorized` - Authentication required (401)
 * - `database_busy` - Database is locked/busy, client should retry (503)
 */
export type ApiErrorCode =
  | 'internal_error'
  | 'validation_error'
  | 'not_found'
  | 'unauthorized'
  | 'database_busy';

export interface ApiError {
  message: string;
  status?: number;
  code?:   ApiErrorCode;
}

export type HealthResponse = {
  status:  string;
  version: string;
  service: string;
};
