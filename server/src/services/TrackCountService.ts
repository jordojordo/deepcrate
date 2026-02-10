import logger from '@server/config/logger';
import MusicBrainzClient from '@server/services/clients/MusicBrainzClient';
import DeezerClient from '@server/services/clients/DeezerClient';

/**
 * TrackCountService orchestrates expected track count resolution
 * using MusicBrainz (primary) with Deezer fallback.
 */
export class TrackCountService {
  private musicBrainzClient: MusicBrainzClient;
  private deezerClient:      DeezerClient;

  constructor() {
    this.musicBrainzClient = new MusicBrainzClient();
    this.deezerClient = new DeezerClient();
  }

  /**
   * Resolve expected track count for an album.
   * 1. If mbid available, try MusicBrainz
   * 2. If MB fails or no mbid, try Deezer
   * 3. Return null if both fail (scoring falls back to current behavior)
   */
  async resolveExpectedTrackCount(params: {
    mbid?:  string;
    artist: string;
    album:  string;
  }): Promise<number | null> {
    const { mbid, artist, album } = params;

    // Try MusicBrainz first if we have an mbid
    if (mbid) {
      const mbCount = await this.musicBrainzClient.getExpectedTrackCount(mbid);

      if (mbCount !== null) {
        logger.debug(`Track count from MusicBrainz for ${ artist } - ${ album }: ${ mbCount }`);

        return mbCount;
      }
    }

    // Fallback to Deezer
    const deezerCount = await this.deezerClient.getAlbumTrackCount(artist, album);

    if (deezerCount !== null) {
      logger.debug(`Track count from Deezer for ${ artist } - ${ album }: ${ deezerCount }`);

      return deezerCount;
    }

    logger.debug(`Could not resolve track count for ${ artist } - ${ album }`);

    return null;
  }
}

export default TrackCountService;
