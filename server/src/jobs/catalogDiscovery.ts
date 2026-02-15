import type { SimilarArtistResult, SimilarityProvider } from '@server/types/similarity';
import type { SimilarArtistAttributes } from '@server/models/SimilarArtist';

import { Op } from '@sequelize/core';

import logger from '@server/config/logger';
import { JOB_NAMES } from '@server/constants/jobs';
import { getConfig } from '@server/config/settings';
import { withDbWrite } from '@server/config/db';
import { SubsonicClient } from '@server/services/clients/SubsonicClient';
import { MusicBrainzClient } from '@server/services/clients/MusicBrainzClient';
import { CoverArtArchiveClient } from '@server/services/clients/CoverArtArchiveClient';
import { QueueService } from '@server/services/QueueService';
import { LastFmSimilarityProvider, ListenBrainzSimilarityProvider } from '@server/services/providers';
import CatalogArtist from '@server/models/CatalogArtist';
import DiscoveredArtist from '@server/models/DiscoveredArtist';
import SimilarArtist from '@server/models/SimilarArtist';
import { isJobCancelled, isJobRunning } from '@server/plugins/jobs';

interface SimilarArtistScore {
  name:        string;
  nameLower:   string;
  score:       number;
  sourceCount: number; // Number of library artists this is similar to
  similarTo:   Set<string>;
  providers:   Set<string>; // Track which providers found this artist
}

/**
 * Catalog Discovery Job
 *
 * Scans the user's Subsonic server library and finds similar artists using configured providers.
 * Fetches discographies from MusicBrainz and adds to pending queue.
 *
 * Algorithm:
 * 1. Sync library artists from Subsonic server
 * 2. For each library artist, fetch similar artists from all configured providers
 * 3. Aggregate similarity scores (artists similar to multiple library artists rank higher)
 * 4. Apply intersection boost for artists found by multiple providers
 * 5. Filter out already-discovered artists and library artists
 * 6. Fetch albums for top N artists from MusicBrainz
 * 7. Add to queue (manual or auto mode)
 */
export async function catalogDiscoveryJob(): Promise<void> {
  const config = getConfig();
  const catalogConfig = config.catalog_discovery;

  if (!catalogConfig || !catalogConfig.enabled) {
    logger.debug('Catalog discovery not enabled, skipping');

    return;
  }

  if (!catalogConfig.subsonic) {
    logger.warn('Catalog discovery: Subsonic server not configured, skipping');

    return;
  }

  // Initialize similarity providers
  const providers: SimilarityProvider[] = [];

  if (catalogConfig.lastfm?.api_key) {
    providers.push(new LastFmSimilarityProvider(catalogConfig.lastfm.api_key));
  }

  if (catalogConfig.listenbrainz?.enabled) {
    providers.push(new ListenBrainzSimilarityProvider());
  }

  if (providers.length === 0) {
    logger.warn('Catalog discovery: no similarity providers configured, skipping');

    return;
  }

  const providerNames = providers.map((p) => p.name).join(', ');

  logger.info(`Starting catalog discovery job (providers: ${ providerNames })`);

  const subsonicClient = new SubsonicClient(
    catalogConfig.subsonic.host,
    catalogConfig.subsonic.username,
    catalogConfig.subsonic.password
  );
  const mbClient = new MusicBrainzClient();
  const coverClient = new CoverArtArchiveClient();
  const queueService = new QueueService();

  try {
    // Defer if listenbrainz-fetch is running — both jobs share MusicBrainz API
    if (isJobRunning(JOB_NAMES.LB_FETCH)) {
      logger.info('Deferring catalog discovery: listenbrainz-fetch is currently running');

      return;
    }

    // Check for cancellation before starting
    if (isJobCancelled(JOB_NAMES.CATALOGD)) {
      logger.info('Job cancelled before syncing library');
      throw new Error('Job cancelled');
    }

    // Step 1: Sync library artists from Subsonic server
    logger.info('Syncing library artists from Subsonic server...');
    const libraryArtists = await subsonicClient.getArtists();
    const libraryArtistNames = new Set<string>();

    // Save to database for future reference
    for (const [nameLower, artist] of Object.entries(libraryArtists)) {
      libraryArtistNames.add(nameLower);

      await withDbWrite(() => CatalogArtist.upsert({
        navidromeId:  artist.id,
        name:         artist.name,
        nameLower,
        lastSyncedAt: new Date(),
      }));
    }

    logger.info(`Synced ${ libraryArtistNames.size } library artists`);

    // Step 1.5: Resolve missing artist MBIDs (scoped to current library artists only)
    const unresolvedArtists = await CatalogArtist.findAll({
      where: {
        mbid:      null,
        nameLower: { [Op.in]: Array.from(libraryArtistNames) },
      },
    });

    if (unresolvedArtists.length > 0) {
      logger.info(`Resolving MBIDs for ${ unresolvedArtists.length } artists...`);

      for (const artist of unresolvedArtists) {
        if (isJobCancelled(JOB_NAMES.CATALOGD)) {
          logger.info('Job cancelled while resolving MBIDs');
          throw new Error('Job cancelled');
        }

        await sleep(1000); // MusicBrainz rate limit: 1 req/sec
        const { results } = await mbClient.searchArtists(artist.name, 1);

        if (results.length > 0) {
          await withDbWrite(() => artist.update({ mbid: results[0].mbid }));
          logger.debug(`Resolved MBID for "${ artist.name }": ${ results[0].mbid }`);
        }
      }

      logger.info('MBID resolution complete');
    }

    // Build MBID lookup from database
    const allCatalogArtists = await CatalogArtist.findAll();
    const mbidByNameLower = new Map<string, string | null>();

    for (const ca of allCatalogArtists) {
      mbidByNameLower.set(ca.nameLower, ca.mbid);
    }

    // Step 2: Fetch similar artists (with caching)
    const similarArtistLimit = catalogConfig.similar_artist_limit || 10;
    const providerTimeout = catalogConfig.provider_timeout_ms || 30000;
    const cacheTtlMs = (catalogConfig.similarity_cache_ttl_days ?? 30) * 24 * 60 * 60 * 1000;

    const catalogNameById = new Map<number, string>();

    for (const ca of allCatalogArtists) {
      catalogNameById.set(ca.id, ca.name);
    }

    // Partition into stale vs cached
    const currentLibraryArtists = allCatalogArtists.filter((ca) => libraryArtistNames.has(ca.nameLower));
    const { stale, cached } = partitionByCacheStatus(currentLibraryArtists, cacheTtlMs);

    logger.info(`Similarity cache: ${ cached.length } cached, ${ stale.length } need fetch`);

    // Fetch from providers only for stale artists
    if (stale.length > 0) {
      const MAX_CONSECUTIVE_FAILURES = 5;
      let processedCount = 0;
      let consecutiveFailures = 0;

      for (const artist of stale) {
        if (isJobCancelled(JOB_NAMES.CATALOGD)) {
          logger.info('Job cancelled while fetching similar artists');
          throw new Error('Job cancelled');
        }

        processedCount++;

        if (processedCount > 1) {
          await sleep(1000);
        }

        const cachedMbid = artist.mbid ?? undefined;
        const results = await fetchSimilarFromAllProviders(
          providers, artist.name, cachedMbid, similarArtistLimit, providerTimeout
        );

        if (results.length === 0) {
          consecutiveFailures++;

          if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
            logger.warn(`Aborting: ${ MAX_CONSECUTIVE_FAILURES } consecutive artists returned no results (providers may be unreachable)`);
            break;
          }
        } else {
          consecutiveFailures = 0;
        }

        // Write results to cache
        const now = new Date();

        for (const sim of results) {
          await withDbWrite(() => SimilarArtist.upsert({
            catalogArtistId: artist.id,
            name:            sim.name,
            nameLower:       sim.name.toLowerCase(),
            mbid:            sim.mbid ?? null,
            score:           sim.match,
            provider:        sim.provider,
            fetchedAt:       now,
          }));
        }

        await withDbWrite(() => artist.update({ lastSimilarFetchedAt: now }));
      }

      logger.info(`Fetched similarity data for ${ processedCount } artists`);
    }

    const currentArtistIds = currentLibraryArtists.map((ca) => ca.id);
    const cachedRows = await SimilarArtist.findAll({ where: { catalogArtistId: { [Op.in]: currentArtistIds } } });

    const similarArtistMap = aggregateSimilarFromCache(cachedRows, libraryArtistNames, catalogNameById);

    logger.info(`Found ${ similarArtistMap.size } similar artists`);

    // Step 3: Filter and rank with provider bonus
    const minSimilarity = catalogConfig.min_similarity || 0.3;
    const maxArtists = catalogConfig.max_artists_per_run || 10;

    // Get already discovered artists
    const alreadyDiscovered = await DiscoveredArtist.findAll({ where: { nameLower: { [Op.in]: Array.from(similarArtistMap.keys()) } } });
    const discoveredSet = new Set(alreadyDiscovered.map((a) => a.nameLower));

    // Filter and sort
    const candidateArtists = Array.from(similarArtistMap.values())
      .filter((a) => !discoveredSet.has(a.nameLower))
      .filter((a) => a.sourceCount > 0 && (a.score / a.sourceCount) >= minSimilarity)
      .sort((a, b) => {
        // Sort by provider count first (intersection boost)
        if (b.providers.size !== a.providers.size) {
          return b.providers.size - a.providers.size;
        }

        // Then by source count (artists similar to more library artists)
        if (b.sourceCount !== a.sourceCount) {
          return b.sourceCount - a.sourceCount;
        }

        // Then by aggregate score
        return b.score - a.score;
      })
      .slice(0, maxArtists);

    logger.info(`Selected ${ candidateArtists.length } artists for discovery`);

    if (candidateArtists.length === 0) {
      logger.info('No new artists to discover');

      return;
    }

    // Step 4: Fetch albums from MusicBrainz and add to queue
    const albumsPerArtist = catalogConfig.albums_per_artist || 3;
    const approvalMode = catalogConfig.mode || 'manual';
    let addedCount = 0;

    for (const artist of candidateArtists) {
      const avgMatchPercent = normalizeCatalogScoreToPercent(artist.score, artist.sourceCount);
      const weightedScore = calculateWeightedCatalogScoreToPercent(
        artist.score,
        artist.sourceCount,
        artist.providers.size,
        similarArtistLimit
      );

      // Check for cancellation
      if (isJobCancelled(JOB_NAMES.CATALOGD)) {
        logger.info('Job cancelled while processing candidate artists');
        throw new Error('Job cancelled');
      }

      const providerList = Array.from(artist.providers).join('+');

      logger.info(
        `  Discovering: ${ artist.name } (avg match: ${ avgMatchPercent?.toFixed(2) ?? 'n/a' }%, ` +
        `weighted: ${ weightedScore?.toFixed(2) ?? 'n/a' }%, sources: ${ artist.sourceCount }, providers: ${ providerList })`
      );

      // Rate limiting for MusicBrainz (1 request/second)
      await sleep(1000);

      // Fetch albums
      const albums = await mbClient.searchReleaseGroups(artist.name, 'Album', albumsPerArtist);

      for (const album of albums) {
        const albumMbid = album.id;

        // Check if already in queue or rejected
        const isPending = await queueService.isPending(albumMbid);
        const isRejected = await queueService.isRejected(albumMbid);

        if (isPending || isRejected) {
          continue;
        }

        // Get cover art
        await sleep(500); // Be nice to Cover Art Archive
        const coverUrl = coverClient.getCoverUrl(albumMbid);

        // Extract year
        let year: number | undefined;
        const releaseDate = album['first-release-date'] || '';

        if (releaseDate && releaseDate.length >= 4) {
          const parsedYear = parseInt(releaseDate.substring(0, 4), 10);

          if (!isNaN(parsedYear)) {
            year = parsedYear;
          }
        }

        // Add to queue
        if (approvalMode === 'manual') {
          await queueService.addPending({
            artist:    artist.name,
            album:     album.title,
            mbid:      albumMbid,
            type:      'album',
            score:     weightedScore,
            source:    'catalog',
            similarTo: Array.from(artist.similarTo).sort((a, b) => a.localeCompare(b)),
            coverUrl:  coverUrl || undefined,
            year,
          });

          logger.info(`    ? ${ artist.name } - ${ album.title } (pending approval)`);
        } else {
          // Auto mode: TODO - add directly to wishlist
          logger.info(`    + ${ artist.name } - ${ album.title }`);
        }

        addedCount++;
      }

      // Mark artist as discovered
      await withDbWrite(() => DiscoveredArtist.create({
        nameLower:    artist.nameLower,
        discoveredAt: new Date(),
      }));
    }

    logger.info(`Catalog discovery completed: added ${ addedCount } albums from ${ candidateArtists.length } artists`);
  } catch(error) {
    logger.error('Catalog discovery job failed:', { error });
    throw error;
  }
}

/**
 * Fetch similar artists from all providers in parallel with timeout.
 * Exported for testing.
 */
export async function fetchSimilarFromAllProviders(
  providers: SimilarityProvider[],
  artistName: string,
  artistMbid: string | undefined,
  limit: number,
  timeoutMs: number = 10000
): Promise<SimilarArtistResult[]> {
  const results: SimilarArtistResult[] = [];

  const fetchWithTimeout = async(provider: SimilarityProvider): Promise<SimilarArtistResult[]> => {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      logger.debug(`Provider ${ provider.name } timed out for "${ artistName }"`);
      controller.abort();
    }, timeoutMs);

    try {
      return await provider.getSimilarArtists(artistName, artistMbid, limit, controller.signal);
    } catch {
      return [];
    } finally {
      clearTimeout(timer);
    }
  };

  const allResults = await Promise.allSettled(providers.map(fetchWithTimeout));

  for (const result of allResults) {
    if (result.status === 'fulfilled') {
      results.push(...result.value);
    }
  }

  return results;
}

/**
 * Sleep helper for rate limiting
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Normalize aggregated similarity scores to a percent scale for display.
 * Uses average match (aggregate / sources) to keep values in 0-100.
 */
function normalizeCatalogScoreToPercent(score: number, sourceCount: number): number | undefined {
  if (!sourceCount) {
    return undefined;
  }

  const averageMatch = score / sourceCount;
  const asPercent = averageMatch <= 1 ? averageMatch * 100 : averageMatch;

  return Math.round(asPercent * 100) / 100;
}

/**
 * Calculate a weighted score that incorporates how many library artists suggested this candidate
 * and applies intersection boost for multi-provider matches.
 *
 * Uses `avg_match_percent * (sources / similar_artist_limit) * provider_bonus`, clamped to 0-100.
 * Provider bonus: 20% per additional provider (1.0 for 1 provider, 1.2 for 2, 1.4 for 3, etc.)
 */
function calculateWeightedCatalogScoreToPercent(
  score: number,
  sourceCount: number,
  providerCount: number,
  similarArtistLimit: number,
): number | undefined {
  const avgMatchPercent = normalizeCatalogScoreToPercent(score, sourceCount);

  if (avgMatchPercent === undefined) {
    return undefined;
  }

  if (!similarArtistLimit) {
    return avgMatchPercent;
  }

  // 20% bonus per additional provider
  const providerBonus = 1 + (Math.max(0, providerCount - 1) * 0.2);
  const weighted = (avgMatchPercent * sourceCount * providerBonus) / similarArtistLimit;
  const clamped = Math.min(100, Math.max(0, weighted));

  return Math.round(clamped * 100) / 100;
}

/**
 * Partition catalog artists into stale (need fetch) vs cached (within TTL).
 * TTL of 0 means all artists are stale (bypass cache).
 */
export function partitionByCacheStatus(
  artists: CatalogArtist[],
  cacheTtlMs: number,
): { stale: CatalogArtist[]; cached: CatalogArtist[] } {
  const now = Date.now();
  const stale: CatalogArtist[] = [];
  const cached: CatalogArtist[] = [];

  for (const artist of artists) {
    if (
      cacheTtlMs === 0
      || !artist.lastSimilarFetchedAt
      || (now - artist.lastSimilarFetchedAt.getTime()) > cacheTtlMs
    ) {
      stale.push(artist);
    } else {
      cached.push(artist);
    }
  }

  return { stale, cached };
}

/**
 * Aggregate cached similar artist rows into the same Map structure used for ranking.
 */
export function aggregateSimilarFromCache(
  rows: SimilarArtistAttributes[],
  libraryArtistNames: Set<string>,
  catalogNameById: Map<number, string>,
): Map<string, SimilarArtistScore> {
  const map = new Map<string, SimilarArtistScore>();

  for (const row of rows) {
    // Skip library artists
    if (libraryArtistNames.has(row.nameLower)) {
      continue;
    }

    const sourceName = catalogNameById.get(row.catalogArtistId) ?? 'unknown';

    if (map.has(row.nameLower)) {
      const existing = map.get(row.nameLower)!;

      existing.score += row.score;
      existing.sourceCount++;
      existing.similarTo.add(sourceName);
      existing.providers.add(row.provider);
    } else {
      map.set(row.nameLower, {
        name:        row.name,
        nameLower:   row.nameLower,
        score:       row.score,
        sourceCount: 1,
        similarTo:   new Set([sourceName]),
        providers:   new Set([row.provider]),
      });
    }
  }

  return map;
}
