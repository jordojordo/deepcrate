import axios from 'axios';
import logger from '@server/config/logger';

const USER_AGENT = 'resonance/1.0 (music-discovery)';
const BASE_URL = 'https://musicbrainz.org/ws/2';

export interface RecordingInfo {
  artist: string;
  title:  string;
  mbid:   string;
}

export interface AlbumInfo {
  artist:        string;
  title:         string;
  mbid:          string;  // Release-group MBID
  recordingMbid: string;
  trackTitle:    string;
  year?:         number;
}

export interface ReleaseGroup {
  id:                    string;
  title:                 string;
  'primary-type'?:       string;
  'first-release-date'?: string;
}

/**
 * MusicBrainzClient provides access to MusicBrainz metadata API.
 * https://musicbrainz.org/doc/MusicBrainz_API
 */
export class MusicBrainzClient {
  /**
   * Resolve a recording MBID to artist + title
   */
  async resolveRecording(mbid: string): Promise<RecordingInfo | null> {
    const url = `${ BASE_URL }/recording/${ mbid }`;

    try {
      const response = await axios.get(url, {
        headers: { 'User-Agent': USER_AGENT },
        params:  {
          inc: 'artists',
          fmt: 'json',
        },
        timeout: 15000,
      });

      const data = response.data;

      // Extract artists
      const artists: string[] = [];

      for (const credit of data['artist-credit'] || []) {
        if (credit.artist) {
          artists.push(credit.artist.name);
        }
      }

      const artist = artists.join(' & ');
      const title = data.title;

      if (artist && title) {
        return {
          artist,
          title,
          mbid,
        };
      }
    } catch(error) {
      if (axios.isAxiosError(error)) {
        logger.error(`Failed to resolve recording ${ mbid }: ${ error.message }`);
      } else {
        logger.error(`Failed to resolve recording ${ mbid }: ${ String(error) }`);
      }
    }

    return null;
  }

  /**
   * Resolve a recording MBID to its parent album (release-group)
   */
  async resolveRecordingToAlbum(mbid: string): Promise<AlbumInfo | null> {
    const url = `${ BASE_URL }/recording/${ mbid }`;

    try {
      const response = await axios.get(url, {
        headers: { 'User-Agent': USER_AGENT },
        params:  {
          inc: 'artists+releases+release-groups',
          fmt: 'json',
        },
        timeout: 15000,
      });

      const data = response.data;

      // Extract artists
      const artists: string[] = [];

      for (const credit of data['artist-credit'] || []) {
        if (credit.artist) {
          artists.push(credit.artist.name);
        }
      }

      const artist = artists.join(' & ');

      if (!artist) {
        return null;
      }

      const trackTitle = data.title || '';

      // Get releases
      const releases = data.releases || [];

      if (!releases.length) {
        logger.debug(`Recording ${ mbid } has no releases`);

        return null;
      }

      // Prefer official albums over singles/EPs/compilations
      let albumRelease = null;

      for (const release of releases) {
        const rg = release['release-group'] || {};
        const primaryType = rg['primary-type'] || '';

        if (primaryType === 'Album') {
          albumRelease = release;
          break;
        }
      }

      // Fall back to first release if no album found
      if (!albumRelease) {
        albumRelease = releases[0];
      }

      const rg = albumRelease['release-group'] || {};
      const rgMbid = rg.id;
      const albumTitle = rg.title || albumRelease.title;

      // Extract year from first-release-date
      let year: number | undefined;
      const releaseDate = rg['first-release-date'] || albumRelease.date || '';

      if (releaseDate && releaseDate.length >= 4) {
        const parsedYear = parseInt(releaseDate.substring(0, 4), 10);

        if (!isNaN(parsedYear)) {
          year = parsedYear;
        }
      }

      if (rgMbid && albumTitle) {
        return {
          artist,
          title:         albumTitle,
          mbid:          rgMbid,
          recordingMbid: mbid,
          trackTitle,
          year,
        };
      }
    } catch(error) {
      if (axios.isAxiosError(error)) {
        logger.error(`Failed to resolve recording ${ mbid } to album: ${ error.message }`);
      } else {
        logger.error(`Failed to resolve recording ${ mbid } to album: ${ String(error) }`);
      }
    }

    return null;
  }

  /**
   * Search for release groups (albums) by artist
   */
  async searchReleaseGroups(
    artist: string,
    type: 'Album' | 'EP' | 'Single' = 'Album',
    limit: number = 20
  ): Promise<ReleaseGroup[]> {
    const url = `${ BASE_URL }/release-group`;

    try {
      const response = await axios.get(url, {
        headers: { 'User-Agent': USER_AGENT },
        params:  {
          query:  `artist:"${ artist }" AND type:${ type }`,
          limit,
          fmt:    'json',
        },
        timeout: 15000,
      });

      return response.data['release-groups'] || [];
    } catch(error) {
      if (axios.isAxiosError(error)) {
        logger.error(`Failed to search release groups for ${ artist }: ${ error.message }`);
      } else {
        logger.error(`Failed to search release groups for ${ artist }: ${ String(error) }`);
      }

      return [];
    }
  }
}

export default MusicBrainzClient;
