import {
  describe, it, expect, vi, beforeEach, afterEach 
} from 'vitest';

import type { SimilarArtistResult, SimilarityProvider } from '@server/types/similarity';

import { fetchSimilarFromAllProviders } from './catalogDiscovery';

/**
 * Mock provider for testing
 */
class MockProvider implements SimilarityProvider {
  name:                 string;
  private results:      SimilarArtistResult[];
  private shouldThrow:  boolean;
  private errorMessage: string;
  private delayMs:      number;

  constructor(
    name: string,
    results: SimilarArtistResult[] = [],
    options: { shouldThrow?: boolean; errorMessage?: string; delayMs?: number } = {}
  ) {
    this.name = name;
    this.results = results;
    this.shouldThrow = options.shouldThrow ?? false;
    this.errorMessage = options.errorMessage ?? 'Provider error';
    this.delayMs = options.delayMs ?? 0;
  }

  isConfigured(): boolean {
    return true;
  }

  async getSimilarArtists(): Promise<SimilarArtistResult[]> {
    if (this.delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, this.delayMs));
    }

    if (this.shouldThrow) {
      throw new Error(this.errorMessage);
    }

    return this.results;
  }
}

describe('catalogDiscovery', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('fetchSimilarFromAllProviders', () => {
    it('combines results from multiple providers', async() => {
      const lastfmProvider = new MockProvider('lastfm', [
        {
          name: 'Artist A', match: 0.9, mbid: 'mbid-a', provider: 'lastfm'
        },
        {
          name: 'Artist B', match: 0.8, mbid: 'mbid-b', provider: 'lastfm'
        },
      ]);

      const lbProvider = new MockProvider('listenbrainz', [
        {
          name: 'Artist C', match: 0.85, mbid: 'mbid-c', provider: 'listenbrainz'
        },
      ]);

      const results = await fetchSimilarFromAllProviders(
        [lastfmProvider, lbProvider],
        'Test Artist',
        undefined,
        10,
        5000
      );

      expect(results).toHaveLength(3);
      expect(results.map((r) => r.name)).toContain('Artist A');
      expect(results.map((r) => r.name)).toContain('Artist B');
      expect(results.map((r) => r.name)).toContain('Artist C');
    });

    it('returns same artist from both providers (for intersection boost)', async() => {
      // Both providers return the same artist with different scores
      const lastfmProvider = new MockProvider('lastfm', [
        {
          name: 'Shared Artist', match: 0.9, mbid: 'mbid-shared', provider: 'lastfm'
        },
        {
          name: 'LastFm Only', match: 0.7, mbid: 'mbid-lfm', provider: 'lastfm'
        },
      ]);

      const lbProvider = new MockProvider('listenbrainz', [
        {
          name: 'Shared Artist', match: 0.85, mbid: 'mbid-shared', provider: 'listenbrainz'
        },
        {
          name: 'LB Only', match: 0.75, mbid: 'mbid-lb', provider: 'listenbrainz'
        },
      ]);

      const results = await fetchSimilarFromAllProviders(
        [lastfmProvider, lbProvider],
        'Test Artist',
        undefined,
        10,
        5000
      );

      // Should have 4 results total (2 from each provider)
      expect(results).toHaveLength(4);

      // Shared Artist appears twice with different providers
      const sharedResults = results.filter((r) => r.name === 'Shared Artist');

      expect(sharedResults).toHaveLength(2);
      expect(sharedResults.map((r) => r.provider).sort()).toEqual(['lastfm', 'listenbrainz']);
    });

    it('handles provider exception gracefully (returns results from other providers)', async() => {
      const workingProvider = new MockProvider('lastfm', [
        {
          name: 'Good Artist', match: 0.9, mbid: 'mbid-good', provider: 'lastfm'
        },
      ]);

      const failingProvider = new MockProvider('listenbrainz', [], {
        shouldThrow:  true,
        errorMessage: 'API connection failed',
      });

      const results = await fetchSimilarFromAllProviders(
        [workingProvider, failingProvider],
        'Test Artist',
        undefined,
        10,
        5000
      );

      // Should only have results from the working provider
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('Good Artist');
      expect(results[0].provider).toBe('lastfm');
    });

    it('handles all providers failing gracefully', async() => {
      const failingProvider1 = new MockProvider('lastfm', [], {
        shouldThrow:  true,
        errorMessage: 'Last.fm API error',
      });

      const failingProvider2 = new MockProvider('listenbrainz', [], {
        shouldThrow:  true,
        errorMessage: 'ListenBrainz API error',
      });

      const results = await fetchSimilarFromAllProviders(
        [failingProvider1, failingProvider2],
        'Test Artist',
        undefined,
        10,
        5000
      );

      expect(results).toEqual([]);
    });

    it('handles provider timeout (returns results from faster providers)', async() => {
      const fastProvider = new MockProvider('lastfm', [
        {
          name: 'Fast Result', match: 0.9, mbid: 'mbid-fast', provider: 'lastfm'
        },
      ]);

      // This provider takes longer than the timeout
      const slowProvider = new MockProvider('listenbrainz', [
        {
          name: 'Slow Result', match: 0.8, mbid: 'mbid-slow', provider: 'listenbrainz'
        },
      ], { delayMs: 200 });

      const resultsPromise = fetchSimilarFromAllProviders(
        [fastProvider, slowProvider],
        'Test Artist',
        undefined,
        10,
        100 // 100ms timeout - slower than slowProvider's 200ms delay
      );

      // Advance timers to let the timeout resolve
      await vi.advanceTimersByTimeAsync(250);

      const results = await resultsPromise;

      // Should only have results from the fast provider
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('Fast Result');
      expect(results[0].provider).toBe('lastfm');
    });

    it('returns empty array when no providers configured', async() => {
      const results = await fetchSimilarFromAllProviders(
        [],
        'Test Artist',
        undefined,
        10,
        5000
      );

      expect(results).toEqual([]);
    });
  });

  describe('intersection boost logic', () => {
    it('aggregates scores correctly when same artist is found by multiple providers', async() => {
      // Simulate the aggregation logic used in catalogDiscoveryJob
      const lastfmProvider = new MockProvider('lastfm', [
        {
          name: 'Intersection Artist', match: 0.9, mbid: 'mbid-1', provider: 'lastfm'
        },
        {
          name: 'LastFm Only', match: 0.95, mbid: 'mbid-2', provider: 'lastfm'
        },
      ]);

      const lbProvider = new MockProvider('listenbrainz', [
        {
          name: 'Intersection Artist', match: 0.8, mbid: 'mbid-1', provider: 'listenbrainz'
        },
        {
          name: 'LB Only', match: 0.85, mbid: 'mbid-3', provider: 'listenbrainz'
        },
      ]);

      const results = await fetchSimilarFromAllProviders(
        [lastfmProvider, lbProvider],
        'Library Artist',
        undefined,
        10,
        5000
      );

      // Simulate the aggregation logic from catalogDiscoveryJob
      interface ArtistScore {
        name:        string;
        nameLower:   string;
        score:       number;
        sourceCount: number;
        providers:   Set<string>;
      }

      const artistMap = new Map<string, ArtistScore>();

      for (const sim of results) {
        const nameLower = sim.name.toLowerCase();

        if (artistMap.has(nameLower)) {
          const existing = artistMap.get(nameLower)!;

          existing.score += sim.match;
          existing.sourceCount++;
          existing.providers.add(sim.provider);
        } else {
          artistMap.set(nameLower, {
            name:        sim.name,
            nameLower,
            score:       sim.match,
            sourceCount: 1,
            providers:   new Set([sim.provider]),
          });
        }
      }

      // Sort by provider count (intersection boost)
      const sorted = Array.from(artistMap.values()).sort((a, b) => {
        if (b.providers.size !== a.providers.size) {
          return b.providers.size - a.providers.size;
        }

        return b.score - a.score;
      });

      // Intersection Artist should be ranked first (2 providers)
      expect(sorted[0].name).toBe('Intersection Artist');
      expect(sorted[0].providers.size).toBe(2);
      expect(sorted[0].score).toBeCloseTo(1.7); // 0.9 + 0.8

      // Other artists should follow (1 provider each)
      expect(sorted[1].providers.size).toBe(1);
      expect(sorted[2].providers.size).toBe(1);
    });

    it('calculates weighted score with provider bonus correctly', () => {
      // Test the weighted score calculation logic
      const calculateWeightedScore = (
        score: number,
        sourceCount: number,
        providerCount: number,
        similarArtistLimit: number
      ): number => {
        const avgMatchPercent = (score / sourceCount) * 100;
        const providerBonus = 1 + (Math.max(0, providerCount - 1) * 0.2);
        const weighted = (avgMatchPercent * sourceCount * providerBonus) / similarArtistLimit;

        return Math.min(100, Math.max(0, weighted));
      };

      // Single provider, single source
      const score1 = calculateWeightedScore(0.9, 1, 1, 10);

      expect(score1).toBeCloseTo(9); // 90 * 1 * 1.0 / 10 = 9

      // Two providers, single source (20% bonus)
      const score2 = calculateWeightedScore(0.9, 1, 2, 10);

      expect(score2).toBeCloseTo(10.8); // 90 * 1 * 1.2 / 10 = 10.8

      // Two providers, two sources (more library artists suggested this)
      const score3 = calculateWeightedScore(1.7, 2, 2, 10);

      expect(score3).toBeCloseTo(20.4); // 85 * 2 * 1.2 / 10 = 20.4
    });
  });
});
