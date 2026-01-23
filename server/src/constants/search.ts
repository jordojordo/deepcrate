import type { SearchQueryBuilderConfig } from '@server/types/search-query';

/**
 * Default configuration for SearchQueryBuilder
 */
export const DEFAULT_SEARCH_QUERY_CONFIG: SearchQueryBuilderConfig = {
  artistQueryTemplate: '{artist}',
  albumQueryTemplate:  '{artist} - {album}',
  trackQueryTemplate:  '{artist} - {title}',
  fallbackQueries:     [],
  excludeTerms:        [],
};
