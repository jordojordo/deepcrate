import type { QueryContext } from '@server/types/search-query';

import { describe, it, expect } from 'vitest';

import { SearchQueryBuilder } from './SearchQueryBuilder';

describe('SearchQueryBuilder', () => {
  describe('buildQuery', () => {
    it('builds album query with default template', () => {
      const builder = new SearchQueryBuilder();
      const context: QueryContext = {
        artist: 'Dream Theater',
        album:  'Images and Words',
        type:   'album',
      };

      expect(builder.buildQuery(context)).toBe('Dream Theater - Images and Words');
    });

    it('builds track query with default template', () => {
      const builder = new SearchQueryBuilder();
      const context: QueryContext = {
        artist: 'Dream Theater',
        title:  'Pull Me Under',
        type:   'track',
      };

      expect(builder.buildQuery(context)).toBe('Dream Theater - Pull Me Under');
    });

    it('builds album query with custom template', () => {
      const builder = new SearchQueryBuilder({ albumQueryTemplate: '{artist} {album}' });
      const context: QueryContext = {
        artist: 'Larry Carlton',
        album:  'On Solid Ground',
        type:   'album',
      };

      expect(builder.buildQuery(context)).toBe('Larry Carlton On Solid Ground');
    });

    it('includes year when present in template', () => {
      const builder = new SearchQueryBuilder({ albumQueryTemplate: '{artist} {album} {year}' });
      const context: QueryContext = {
        artist: 'Dream Theater',
        album:  'Images and Words',
        year:   1992,
        type:   'album',
      };

      expect(builder.buildQuery(context)).toBe('Dream Theater Images and Words 1992');
    });

    it('handles missing year gracefully', () => {
      const builder = new SearchQueryBuilder({ albumQueryTemplate: '{artist} - {album} ({year})' });
      const context: QueryContext = {
        artist: 'Between the Buried and Me',
        album:  'Colors',
        type:   'album',
      };

      // Empty year should be cleaned up
      expect(builder.buildQuery(context)).toBe('Between the Buried and Me - Colors ()');
    });

    it('cleans up double hyphens from empty substitutions', () => {
      const builder = new SearchQueryBuilder({ albumQueryTemplate: '{artist} - {album} - {year}' });
      const context: QueryContext = {
        artist: 'Larry Carlton',
        album:  'Sleepwalk',
        type:   'album',
      };

      expect(builder.buildQuery(context)).toBe('Larry Carlton - Sleepwalk');
    });
  });

  describe('buildFallbackQuery', () => {
    it('returns configured fallback for first retry', () => {
      const builder = new SearchQueryBuilder({ fallbackQueries: ['{album}', '{artist}'] });
      const context: QueryContext = {
        artist: 'Dream Theater',
        album:  'Awake',
        type:   'album',
      };

      expect(builder.buildFallbackQuery(context, 0)).toBe('Awake');
    });

    it('returns configured fallback for second retry', () => {
      const builder = new SearchQueryBuilder({ fallbackQueries: ['{album}', '{artist}'] });
      const context: QueryContext = {
        artist: 'Dream Theater',
        album:  'Falling into Infinity',
        type:   'album',
      };

      expect(builder.buildFallbackQuery(context, 1)).toBe('Dream Theater');
    });

    it('returns simplified primary query when no more fallbacks', () => {
      const builder = new SearchQueryBuilder({ fallbackQueries: ['{album}'] });
      const context: QueryContext = {
        artist: 'Between the Buried and Me',
        album:  'Alaska',
        type:   'album',
      };

      // attemptIndex 1 is past the fallback list, should simplify primary
      const result = builder.buildFallbackQuery(context, 1, true);

      expect(result).toBe('between the buried and me alaska');
    });

    it('returns null when simplify is disabled and no more fallbacks', () => {
      const builder = new SearchQueryBuilder({ fallbackQueries: ['{album}'] });
      const context: QueryContext = {
        artist: 'LTJ Bukem',
        album:  'Logical Progression',
        type:   'album',
      };

      expect(builder.buildFallbackQuery(context, 1, false)).toBe(null);
    });

    it('returns null when all retries exhausted', () => {
      const builder = new SearchQueryBuilder({ fallbackQueries: ['{album}'] });
      const context: QueryContext = {
        artist: 'Dream Theater',
        album:  'A Change of Seasons',
        type:   'album',
      };

      // attemptIndex 2: past fallbacks and simplified
      expect(builder.buildFallbackQuery(context, 2, true)).toBe(null);
    });
  });

  describe('normalizeQuery', () => {
    it('collapses whitespace', () => {
      const builder = new SearchQueryBuilder();

      expect(builder.normalizeQuery('Dream Theater    Images   and   Words')).toBe('Dream Theater Images and Words');
    });

    it('trims leading and trailing whitespace', () => {
      const builder = new SearchQueryBuilder();

      expect(builder.normalizeQuery('  Larry Carlton  ')).toBe('Larry Carlton');
    });

    it('removes exclude terms', () => {
      const builder = new SearchQueryBuilder({ excludeTerms: ['live', 'remix'] });

      expect(builder.normalizeQuery('Dream Theater Live Album')).toBe('Dream Theater Album');
    });

    it('removes exclude terms case-insensitively', () => {
      const builder = new SearchQueryBuilder({ excludeTerms: ['live'] });

      expect(builder.normalizeQuery('Dream Theater LIVE Album')).toBe('Dream Theater Album');
    });

    it('only removes whole word matches for exclude terms', () => {
      const builder = new SearchQueryBuilder({ excludeTerms: ['live'] });

      expect(builder.normalizeQuery('Alluvial Album')).toBe('Alluvial Album');
    });
  });

  describe('simplifyQuery', () => {
    it('removes diacritics', () => {
      const builder = new SearchQueryBuilder();

      expect(builder.simplifyQuery('Café')).toBe('cafe');
      expect(builder.simplifyQuery('Mötley Crüe')).toBe('motley crue');
      expect(builder.simplifyQuery('Sigur Rós')).toBe('sigur ros');
    });

    it('removes special characters', () => {
      const builder = new SearchQueryBuilder();

      expect(builder.simplifyQuery('At the Drive-In')).toBe('at the drive in');
      expect(builder.simplifyQuery('blink-182')).toBe('blink 182');
      expect(builder.simplifyQuery('Enuff Z\'Nuff')).toBe('enuff z nuff');
    });

    it('converts to lowercase', () => {
      const builder = new SearchQueryBuilder();

      expect(builder.simplifyQuery('DREAM THEATER')).toBe('dream theater');
    });

    it('collapses whitespace', () => {
      const builder = new SearchQueryBuilder();

      expect(builder.simplifyQuery('Dream Theater    Images   and   Words')).toBe('dream theater images and words');
    });

    it('removes exclude terms', () => {
      const builder = new SearchQueryBuilder({ excludeTerms: ['live', 'remix', 'cover'] });

      expect(builder.simplifyQuery('Dream Theater Live in Concert')).toBe('dream theater in concert');
    });

    it('handles complex real-world examples', () => {
      const builder = new SearchQueryBuilder({ excludeTerms: ['remaster', 'remastered'] });

      expect(builder.simplifyQuery('Dream Theater - Images and Words (Remastered)')).toBe('dream theater images and words');
      expect(builder.simplifyQuery('Larry Carlton - Friends [1983]')).toBe('larry carlton friends 1983');
    });
  });

  describe('integration: full retry sequence', () => {
    it('provides correct queries for a full retry sequence', () => {
      const builder = new SearchQueryBuilder({
        albumQueryTemplate: '{artist} - {album}',
        fallbackQueries:    ['{album}', '{artist} {album} {year}'],
        excludeTerms:       ['remastered'],
      });
      const context: QueryContext = {
        artist: 'Dream Theater',
        album:  'Images and Words (Remastered)',
        year:   1992,
        type:   'album',
      };

      // Primary query
      expect(builder.buildQuery(context)).toBe('Dream Theater - Images and Words (Remastered)');

      // First fallback (index 0)
      expect(builder.buildFallbackQuery(context, 0)).toBe('Images and Words (Remastered)');

      // Second fallback (index 1)
      expect(builder.buildFallbackQuery(context, 1)).toBe('Dream Theater Images and Words (Remastered) 1992');

      // Third attempt - simplified primary (index 2)
      expect(builder.buildFallbackQuery(context, 2)).toBe('dream theater images and words');

      // No more fallbacks (index 3)
      expect(builder.buildFallbackQuery(context, 3)).toBe(null);
    });
  });
});
