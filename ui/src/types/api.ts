export interface PaginatedResponse<T> {
  items:  T[]
  total:  number
  limit:  number
  offset: number
}

export interface ApiError {
  message: string
  status?: number
}
