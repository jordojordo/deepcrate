import type { AlbumSearchResult, ArtistSearchResult, RecordingSearchResult } from '@server/types/search';
import type {
  AlbumInfo,
  RecordingInfo,
  ReleaseGroup,
  ReleaseGroupTrack,
  SearchResults,
} from '@server/types/musicbrainz';

import axios from 'axios';
import logger from '@server/config/logger';

const USER_AGENT = 'deepcrate/1.0 (music-discovery)';
const BASE_URL = 'https://musicbrainz.org/ws/2';

/**
 * MusicBrainzClient provides access to MusicBrainz metadata API.
 * https://musicbrainz.org/doc/MusicBrainz_API
 * https://musicbrainz.org/doc/MusicBrainz_API/Search#Recording
 */
export class MusicBrainzClient {
  /**
   * Resolve a recording MBID to artist + title + release-group MBID
   */
  async resolveRecording(mbid: string): Promise<RecordingInfo | null> {
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
      const title = data.title;

      // Extract release-group MBID for cover art
      let releaseGroupMbid: string | undefined;
      const releases = data.releases || [];

      if (releases.length > 0) {
        // Prefer official albums over singles/EPs/compilations
        let bestRelease = null;

        for (const release of releases) {
          const rg = release['release-group'] || {};
          const primaryType = rg['primary-type'] || '';

          if (primaryType === 'Album') {
            bestRelease = release;
            break;
          }
        }

        // Fall back to first release if no album found
        if (!bestRelease) {
          bestRelease = releases[0];
        }

        const rg = bestRelease['release-group'] || {};

        releaseGroupMbid = rg.id;
      }

      if (artist && title) {
        return {
          artist,
          title,
          mbid,
          releaseGroupMbid,
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

  /**
   * Search for albums by query string
   */
  async searchAlbums(
    query: string,
    limit: number = 20
  ): Promise<SearchResults<AlbumSearchResult>> {
    const url = `${ BASE_URL }/release-group`;

    try {
      const response = await axios.get(url, {
        headers: { 'User-Agent': USER_AGENT },
        params:  {
          query,
          limit,
          fmt: 'json',
        },
        timeout: 15000,
      });

      const releaseGroups = response.data['release-groups'] || [];
      const total = response.data['release-group-count'] || releaseGroups.length;

      const results = releaseGroups.map((rg: any) => {
        const artistCredit = rg['artist-credit'] || [];
        const artist = artistCredit.map((ac: any) => ac.artist?.name || '').join(' & ') || 'Unknown Artist';
        const firstReleaseDate = rg['first-release-date'] || '';
        const year = firstReleaseDate ? parseInt(firstReleaseDate.substring(0, 4), 10) : null;

        return {
          mbid:   rg.id,
          title:  rg.title,
          artist,
          type:   rg['primary-type'] || null,
          year:   (year !== null && !isNaN(year)) ? year : null,
        };
      });

      return { results, total };
    } catch(error) {
      if (axios.isAxiosError(error)) {
        logger.error(`Failed to search albums for "${ query }": ${ error.message }`);
      } else {
        logger.error(`Failed to search albums for "${ query }": ${ String(error) }`);
      }

      return { results: [], total: 0 };
    }
  }

  /**
   * Search for recordings (tracks) by query string
   */
  async searchRecordings(
    query: string,
    limit: number = 20
  ): Promise<SearchResults<RecordingSearchResult>> {
    const url = `${ BASE_URL }/recording`;

    try {
      const response = await axios.get(url, {
        headers: { 'User-Agent': USER_AGENT },
        params:  {
          query,
          limit,
          fmt: 'json',
        },
        timeout: 15000,
      });

      const recordings = response.data.recordings || [];
      const total = response.data.count || recordings.length;

      const results = recordings.map((rec: any) => {
        const artistCredit = rec['artist-credit'] || [];
        const artist = artistCredit.map((ac: any) => ac.artist?.name || '').join(' & ') || 'Unknown Artist';

        // Get album from first release
        const releases = rec.releases || [];
        const album = releases.length > 0 ? releases[0].title : null;

        // Get year from first release date
        const firstReleaseDate = releases.length > 0 ? releases[0].date || '' : '';
        const year = firstReleaseDate ? parseInt(firstReleaseDate.substring(0, 4), 10) : null;

        return {
          mbid:  rec.id,
          title: rec.title,
          artist,
          album,
          year:  (year !== null && !isNaN(year)) ? year : null,
        };
      });

      return { results, total };
    } catch(error) {
      if (axios.isAxiosError(error)) {
        logger.error(`Failed to search recordings for "${ query }": ${ error.message }`);
      } else {
        logger.error(`Failed to search recordings for "${ query }": ${ String(error) }`);
      }

      return { results: [], total: 0 };
    }
  }

  /**
   * Search for artists by query string
   */
  async searchArtists(
    query: string,
    limit: number = 20
  ): Promise<SearchResults<ArtistSearchResult>> {
    const url = `${ BASE_URL }/artist`;

    try {
      const response = await axios.get(url, {
        headers: { 'User-Agent': USER_AGENT },
        params:  {
          query,
          limit,
          fmt: 'json',
        },
        timeout: 15000,
      });

      const artists = response.data.artists || [];
      const total = response.data.count || artists.length;

      const results = artists.map((artist: any) => {
        const lifeSpan = artist['life-span'] || {};
        const beginYear = lifeSpan.begin ? parseInt(lifeSpan.begin.substring(0, 4), 10) : null;
        const endYear = lifeSpan.end ? parseInt(lifeSpan.end.substring(0, 4), 10) : null;

        return {
          mbid:           artist.id,
          name:           artist.name,
          country:        artist.country || null,
          type:           artist.type || null,
          beginYear:      (beginYear !== null && !isNaN(beginYear)) ? beginYear : null,
          endYear:        (endYear !== null && !isNaN(endYear)) ? endYear : null,
          disambiguation: artist.disambiguation || null,
        };
      });

      return { results, total };
    } catch(error) {
      if (axios.isAxiosError(error)) {
        logger.error(`Failed to search artists for "${ query }": ${ error.message }`);
      } else {
        logger.error(`Failed to search artists for "${ query }": ${ String(error) }`);
      }

      return { results: [], total: 0 };
    }
  }

  /**
   * Get track listing for a release group (album) by MBID
   */
  async getReleaseGroupTracks(mbid: string): Promise<ReleaseGroupTrack[]> {
    // First, get releases for this release-group
    const releasesUrl = `${ BASE_URL }/release`;

    try {
      const releasesResponse = await axios.get(releasesUrl, {
        headers: { 'User-Agent': USER_AGENT },
        params:  {
          'release-group': mbid,
          limit:           1,
          fmt:             'json',
        },
        timeout: 15000,
      });

      const releases = releasesResponse.data.releases || [];

      if (!releases.length) {
        logger.debug(`No releases found for release-group ${ mbid }`);

        return [];
      }

      // Get the first release with media/tracks
      const releaseId = releases[0].id;

      // Now get the full release with recordings
      const releaseUrl = `${ BASE_URL }/release/${ releaseId }`;
      const releaseResponse = await axios.get(releaseUrl, {
        headers: { 'User-Agent': USER_AGENT },
        params:  {
          inc: 'recordings',
          fmt: 'json',
        },
        timeout: 15000,
      });

      const media = releaseResponse.data.media || [];
      const tracks: ReleaseGroupTrack[] = [];

      for (const medium of media) {
        for (const track of medium.tracks || []) {
          tracks.push({
            title:    track.title || track.recording?.title || '',
            position: track.position || tracks.length + 1,
          });
        }
      }

      return tracks;
    } catch(error) {
      if (axios.isAxiosError(error)) {
        logger.error(`Failed to get release-group tracks for ${ mbid }: ${ error.message }`);
      } else {
        logger.error(`Failed to get release-group tracks for ${ mbid }: ${ String(error) }`);
      }

      return [];
    }
  }
}

export default MusicBrainzClient;
