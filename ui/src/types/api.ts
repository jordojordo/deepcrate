export interface PaginatedResponse<T> {
  items:  T[];
  total:  number;
  limit:  number;
  offset: number;
}

export type HealthResponse = {
  status:  string;
  version: string;
  service: string;
};
