import { Op } from '@sequelize/core';
import logger from '@server/config/logger';
import { JOB_NAMES } from '@server/constants/jobs';
import { getConfig } from '@server/config/settings';
import { NavidromeClient } from '@server/services/clients/NavidromeClient';
import { LastFmClient } from '@server/services/clients/LastFmClient';
import { MusicBrainzClient } from '@server/services/clients/MusicBrainzClient';
import { CoverArtArchiveClient } from '@server/services/clients/CoverArtArchiveClient';
import { QueueService } from '@server/services/QueueService';
import CatalogArtist from '@server/models/CatalogArtist';
import DiscoveredArtist from '@server/models/DiscoveredArtist';
import { isJobCancelled } from '@server/plugins/jobs';

interface SimilarArtistScore {
  name:        string;
  nameLower:   string;
  score:       number;
  sourceCount: number; // Number of library artists this is similar to
}

/**
 * Catalog Discovery Job
 *
 * Scans the user's Navidrome library and finds similar artists using Last.fm.
 * Fetches discographies from MusicBrainz and adds to pending queue.
 *
 * Algorithm:
 * 1. Sync library artists from Navidrome
 * 2. For each library artist, fetch similar artists from Last.fm
 * 3. Aggregate similarity scores (artists similar to multiple library artists rank higher)
 * 4. Filter out already-discovered artists and library artists
 * 5. Fetch albums for top N artists from MusicBrainz
 * 6. Add to queue (manual or auto mode)
 */
export async function catalogDiscoveryJob(): Promise<void> {
  const config = getConfig();
  const catalogConfig = config.catalog_discovery;

  if (!catalogConfig || !catalogConfig.enabled) {
    logger.debug('Catalog discovery not enabled, skipping');

    return;
  }

  if (!catalogConfig.navidrome || !catalogConfig.lastfm) {
    logger.warn('Catalog discovery not fully configured, skipping');

    return;
  }

  logger.info('Starting catalog discovery job');

  const navidromeClient = new NavidromeClient(
    catalogConfig.navidrome.host,
    catalogConfig.navidrome.username,
    catalogConfig.navidrome.password
  );
  const lastfmClient = new LastFmClient(catalogConfig.lastfm.api_key);
  const mbClient = new MusicBrainzClient();
  const coverClient = new CoverArtArchiveClient();
  const queueService = new QueueService();

  try {
    // Check for cancellation before starting
    if (isJobCancelled(JOB_NAMES.CATALOGD)) {
      logger.info('Job cancelled before syncing library');
      throw new Error('Job cancelled');
    }

    // Step 1: Sync library artists from Navidrome
    logger.info('Syncing library artists from Navidrome...');
    const libraryArtists = await navidromeClient.getArtists();
    const libraryArtistNames = new Set<string>();

    // Save to database for future reference
    for (const [nameLower, artist] of Object.entries(libraryArtists)) {
      libraryArtistNames.add(nameLower);

      await CatalogArtist.upsert({
        navidromeId:  artist.id,
        name:         artist.name,
        nameLower,
        lastSyncedAt: new Date(),
      });
    }

    logger.info(`Synced ${ libraryArtistNames.size } library artists`);

    // Step 2: Fetch similar artists from Last.fm
    logger.info('Fetching similar artists from Last.fm...');
    const similarArtistMap = new Map<string, SimilarArtistScore>();
    const similarArtistLimit = catalogConfig.similar_artist_limit || 10;
    let processedCount = 0;

    for (const [_nameLower, artist] of Object.entries(libraryArtists)) { // eslint-disable-line
      // Check for cancellation
      if (isJobCancelled(JOB_NAMES.CATALOGD)) {
        logger.info('Job cancelled while fetching similar artists');
        throw new Error('Job cancelled');
      }

      processedCount++;

      // Rate limiting for Last.fm (5 requests/second max, we'll do 1/second to be safe)
      if (processedCount > 1) {
        await sleep(1000);
      }

      const similar = await lastfmClient.getSimilarArtists(artist.name, similarArtistLimit);

      for (const sim of similar) {
        const nameLower = sim.name.toLowerCase();

        // Skip library artists
        if (libraryArtistNames.has(nameLower)) {
          continue;
        }

        // Aggregate scores
        if (similarArtistMap.has(nameLower)) {
          const existing = similarArtistMap.get(nameLower)!;

          existing.score += sim.match;
          existing.sourceCount++;
        } else {
          similarArtistMap.set(nameLower, {
            name:        sim.name,
            nameLower,
            score:       sim.match,
            sourceCount: 1,
          });
        }
      }
    }

    logger.info(`Found ${ similarArtistMap.size } similar artists`);

    // Step 3: Filter and rank
    const minSimilarity = catalogConfig.min_similarity || 0.3;
    const maxArtists = catalogConfig.max_artists_per_run || 10;

    // Get already discovered artists
    const alreadyDiscovered = await DiscoveredArtist.findAll({ where: { nameLower: { [Op.in]: Array.from(similarArtistMap.keys()) } } });
    const discoveredSet = new Set(alreadyDiscovered.map((a) => a.nameLower));

    // Filter and sort
    const candidateArtists = Array.from(similarArtistMap.values())
      .filter((a) => !discoveredSet.has(a.nameLower))
      .filter((a) => a.score >= minSimilarity)
      .sort((a, b) => {
        // Sort by source count first (artists similar to more library artists)
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
      // Check for cancellation
      if (isJobCancelled(JOB_NAMES.CATALOGD)) {
        logger.info('Job cancelled while processing candidate artists');
        throw new Error('Job cancelled');
      }

      logger.info(`  Discovering: ${ artist.name } (score: ${ artist.score.toFixed(2) }, sources: ${ artist.sourceCount })`);

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
            artist:   artist.name,
            album:    album.title,
            mbid:     albumMbid,
            type:     'album',
            score:    Math.round(artist.score * 100) / 100,
            source:   'catalog',
            coverUrl: coverUrl || undefined,
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
      await DiscoveredArtist.create({
        nameLower:    artist.nameLower,
        discoveredAt: new Date(),
      });
    }

    logger.info(`Catalog discovery completed: added ${ addedCount } albums from ${ candidateArtists.length } artists`);
  } catch(error) {
    logger.error('Catalog discovery job failed:', { error });
    throw error;
  }
}

/**
 * Sleep helper for rate limiting
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
