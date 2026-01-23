/**
 * SearchQueryBuilder - Builds and transforms search queries for slskd
 *
 * Handles query template substitution, normalization, simplification,
 * and fallback query generation for retry logic.
 */

import type { QueryContext, SearchQueryBuilderConfig } from '@server/types/search-query';

import { DEFAULT_SEARCH_QUERY_CONFIG } from '@server/constants/search';

/**
 * SearchQueryBuilder builds search queries from templates and provides
 * fallback/simplification logic for retry attempts.
 */
export class SearchQueryBuilder {
  private config: SearchQueryBuilderConfig;

  constructor(config?: Partial<SearchQueryBuilderConfig>) {
    this.config = {
      artistQueryTemplate: config?.artistQueryTemplate ?? DEFAULT_SEARCH_QUERY_CONFIG.artistQueryTemplate,
      albumQueryTemplate:  config?.albumQueryTemplate ?? DEFAULT_SEARCH_QUERY_CONFIG.albumQueryTemplate,
      trackQueryTemplate:  config?.trackQueryTemplate ?? DEFAULT_SEARCH_QUERY_CONFIG.trackQueryTemplate,
      fallbackQueries:     config?.fallbackQueries ?? DEFAULT_SEARCH_QUERY_CONFIG.fallbackQueries,
      excludeTerms:        config?.excludeTerms ?? DEFAULT_SEARCH_QUERY_CONFIG.excludeTerms,
    };
  }

  /**
   * Build the primary search query from template and context.
   */
  buildQuery(context: QueryContext): string {
    let template: string;

    if (context.type === 'album') {
      template = this.config.albumQueryTemplate;
    } else if (context.type === 'artist') {
      template = this.config.artistQueryTemplate;
    } else {
      template = this.config.trackQueryTemplate;
    }

    return this.applyTemplate(template, context);
  }

  /**
   * Build a fallback query for retry attempts.
   *
   * @param context - The query context
   * @param attemptIndex - Zero-based attempt index (0 = first retry, not primary)
   * @param simplifyOnRetry - Whether to apply simplification when no fallback template matches
   * @returns The fallback query, or null if no more fallbacks available
   */
  buildFallbackQuery(context: QueryContext, attemptIndex: number, simplifyOnRetry: boolean = true): string | null {
    // First, try to use a configured fallback template
    if (attemptIndex < this.config.fallbackQueries.length) {
      const template = this.config.fallbackQueries[attemptIndex];

      return this.applyTemplate(template, context);
    }

    // If no more fallback templates and simplify is enabled, return simplified primary query
    if (simplifyOnRetry && attemptIndex === this.config.fallbackQueries.length) {
      const primaryQuery = this.buildQuery(context);

      return this.simplifyQuery(primaryQuery);
    }

    // No more fallbacks available
    return null;
  }

  /**
   * Normalize a query with light processing:
   * - Collapse whitespace
   * - Apply exclude terms filtering
   * - Trim
   */
  normalizeQuery(query: string): string {
    let normalized = query
      .replace(/\s+/g, ' ')
      .trim();

    // Remove exclude terms (case-insensitive word boundary match)
    for (const term of this.config.excludeTerms) {
      const regex = new RegExp(`\\b${ this.escapeRegex(term) }\\b`, 'gi');

      normalized = normalized.replace(regex, '');
    }

    // Clean up any double spaces or leading/trailing spaces created by removal
    return normalized.replace(/\s+/g, ' ').trim();
  }

  /**
   * Simplify a query for broader matching:
   * - Remove diacritics (accented characters)
   * - Remove special characters (keep alphanumeric and spaces)
   * - Collapse whitespace
   * - Apply exclude terms
   */
  simplifyQuery(query: string): string {
    let simplified = query
      // Remove diacritics
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      // Remove special characters (keep letters, numbers, spaces)
      .replace(/[^a-zA-Z0-9\s]/g, ' ')
      // Collapse whitespace
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();

    // Remove exclude terms
    for (const term of this.config.excludeTerms) {
      const regex = new RegExp(`\\b${ this.escapeRegex(term) }\\b`, 'gi');

      simplified = simplified.replace(regex, '');
    }

    // Final cleanup
    return simplified.replace(/\s+/g, ' ').trim();
  }

  /**
   * Apply template variable substitution.
   * Supports: {artist}, {album}, {title}, {year}
   */
  private applyTemplate(template: string, context: QueryContext): string {
    let result = template
      .replace(/\{artist\}/gi, context.artist || '')
      .replace(/\{album\}/gi, context.album || '')
      .replace(/\{title\}/gi, context.title || '')
      .replace(/\{year\}/gi, context.year?.toString() || '');

    // Clean up empty template results (e.g., "{year}" when year is undefined)
    // Remove isolated hyphens from empty substitutions like " - " becoming " -  - "
    result = result
      .replace(/\s+-\s+-\s+/g, ' - ')
      .replace(/\s+-\s+$/g, '')
      .replace(/^\s+-\s+/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    return result;
  }

  /**
   * Escape special regex characters in a string.
   */
  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}

export default SearchQueryBuilder;
