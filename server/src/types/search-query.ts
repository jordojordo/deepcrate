/**
 * Types for SearchQueryBuilder service
 */

/**
 * Context for building a search query
 */
export interface QueryContext {
  artist: string;
  album?: string;
  title?: string;
  year?:  number;
  type:   'album' | 'track';
}

/**
 * Configuration options for SearchQueryBuilder
 */
export interface SearchQueryBuilderConfig {
  albumQueryTemplate: string;
  trackQueryTemplate: string;
  fallbackQueries:    string[];
  excludeTerms:       string[];
}
