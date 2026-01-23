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
  type:   'artist' | 'album' | 'track';
}

/**
 * Configuration options for SearchQueryBuilder
 */
export interface SearchQueryBuilderConfig {
  artistQueryTemplate: string;
  albumQueryTemplate:  string;
  trackQueryTemplate:  string;
  fallbackQueries:     string[];
  excludeTerms:        string[];
}
