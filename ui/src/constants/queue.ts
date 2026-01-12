import type { QueueFilters } from '@/types'

export const DEFAULT_QUEUE_FILTERS: QueueFilters = {
  source: 'all',
  sort:   'added_at',
  order:  'desc',
  limit:  20,
  offset: 0,
}

export const SOURCE_LABELS = {
  listenbrainz: 'ListenBrainz',
  catalog:      'Catalog',
  all:          'All Sources',
} as const

export const SORT_OPTIONS = [
  { value: 'added_at', label: 'Date Added' },
  { value: 'score', label: 'Score' },
  { value: 'artist', label: 'Artist' },
  { value: 'year', label: 'Year' },
] as const
