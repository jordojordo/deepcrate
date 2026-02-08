import axios from 'axios';
import crypto from 'crypto';
import logger from '@server/config/logger';

export interface SubsonicArtist {
  name: string;
  id:   string;
}

/** @deprecated Use SubsonicArtist instead */
export type NavidromeArtist = SubsonicArtist;

export interface SubsonicAlbum {
  id:     string;
  name:   string;
  artist: string;
  year?:  number;
}

/** @deprecated Use SubsonicAlbum instead */
export type NavidromeAlbum = SubsonicAlbum;

/**
 * SubsonicClient provides access to Subsonic-compatible servers (Navidrome, Gonic, Airsonic, etc.).
 * https://www.subsonic.org/pages/api.jsp
 */
export class SubsonicClient {
  private host:     string;
  private username: string;
  private password: string;

  constructor(host: string, username: string, password: string) {
    this.host = host.replace(/\/$/, ''); // Remove trailing slash
    this.username = username;
    this.password = password;
  }

  /**
   * Generate MD5 hash for Subsonic auth
   */
  private md5Hash(text: string): string {
    return crypto.createHash('md5').update(text).digest('hex');
  }

  /**
   * Get all artists from Subsonic server library
   */
  async getArtists(): Promise<Record<string, SubsonicArtist>> {
    const salt = 'catalogdisc';
    const token = this.md5Hash(this.password + salt);

    const params = {
      u: this.username,
      t: token,
      s: salt,
      v: '1.16.1',
      c: 'deepcrate',
      f: 'json',
    };

    const url = `${ this.host }/rest/getArtists`;

    try {
      logger.info(`Fetching artists from Subsonic server at ${ this.host }...`);

      const response = await axios.get(url, {
        params,
        timeout: 30000,
      });

      const data = response.data;

      // Check for Subsonic error
      const subsonicResp = data['subsonic-response'] || {};

      if (subsonicResp.status !== 'ok') {
        const error = subsonicResp.error || {};

        logger.error(`Subsonic API error: ${ error.message || 'Unknown error' }`);

        return {};
      }

      // Parse artist index
      const artists: Record<string, SubsonicArtist> = {};
      const artistIndex = subsonicResp.artists?.index || [];

      for (const indexEntry of artistIndex) {
        for (const artist of indexEntry.artist || []) {
          const name = artist.name || '';
          const artistId = artist.id || '';

          if (name) {
            artists[name.toLowerCase()] = {
              name,
              id: artistId,
            };
          }
        }
      }

      logger.info(`Found ${ Object.keys(artists).length } artists in library`);

      return artists;
    } catch(error) {
      if (axios.isAxiosError(error)) {
        logger.error(`Failed to fetch artists from Subsonic server: ${ error.message }`);
      } else {
        logger.error(`Failed to fetch artists from Subsonic server: ${ String(error) }`);
      }

      return {};
    }
  }

  /**
   * Get all albums from Subsonic server library using paginated requests.
   * Uses Subsonic API getAlbumList2 with alphabeticalByName type.
   */
  async getAlbums(): Promise<SubsonicAlbum[]> {
    const salt = 'librarySync';
    const token = this.md5Hash(this.password + salt);

    const baseParams = {
      u: this.username,
      t: token,
      s: salt,
      v: '1.16.1',
      c: 'deepcrate',
      f: 'json',
    };

    const albums: SubsonicAlbum[] = [];
    const pageSize = 500;
    let offset = 0;
    let hasMore = true;

    try {
      logger.info(`Fetching albums from Subsonic server at ${ this.host }...`);

      while (hasMore) {
        const url = `${ this.host }/rest/getAlbumList2`;
        const params = {
          ...baseParams,
          type:   'alphabeticalByName',
          size:   pageSize,
          offset: offset,
        };

        const response = await axios.get(url, {
          params,
          timeout: 60000, // Longer timeout for large libraries
        });

        const data = response.data;
        const subsonicResp = data['subsonic-response'] || {};

        if (subsonicResp.status !== 'ok') {
          const error = subsonicResp.error || {};
          const code = error.code;

          // Subsonic error codes: 0=generic, 10=missing param, 40=auth, 50=not allowed, 70=not found
          if (code === 40 || code === 50) {
            throw new Error(`Subsonic auth error: ${ error.message || 'Authentication failed' }`);
          }

          logger.error(`Subsonic API error: ${ error.message || 'Unknown error' }`);

          break;
        }

        const albumList = subsonicResp.albumList2?.album || [];

        if (albumList.length === 0) {
          hasMore = false;
        } else {
          for (const album of albumList) {
            albums.push({
              id:     album.id || '',
              name:   album.name || album.title || '',
              artist: album.artist || '',
              year:   album.year,
            });
          }

          offset += albumList.length;

          // If we got less than page size, we've reached the end
          if (albumList.length < pageSize) {
            hasMore = false;
          }
        }
      }

      logger.info(`Found ${ albums.length } albums in library`);

      return albums;
    } catch(error) {
      if (axios.isAxiosError(error)) {
        logger.error(`Failed to fetch albums from Subsonic server: ${ error.message }`);
      } else {
        logger.error(`Failed to fetch albums from Subsonic server: ${ String(error) }`);
      }

      return [];
    }
  }

  /**
   * Trigger a library scan on Subsonic server.
   * Uses Subsonic API startScan.
   */
  async startScan(): Promise<boolean> {
    const salt = 'startScan';
    const token = this.md5Hash(this.password + salt);

    const params = {
      u: this.username,
      t: token,
      s: salt,
      v: '1.16.1',
      c: 'deepcrate',
      f: 'json',
    };

    const url = `${ this.host }/rest/startScan`;

    try {
      logger.info(`Triggering Subsonic server scan at ${ this.host }...`);

      const response = await axios.get(url, {
        params,
        timeout: 30000,
      });

      const data = response.data;
      const subsonicResp = data['subsonic-response'] || {};

      if (subsonicResp.status !== 'ok') {
        const error = subsonicResp.error || {};

        logger.error(`Subsonic startScan error: ${ error.message || 'Unknown error' }`);

        return false;
      }

      return true;
    } catch(error) {
      if (axios.isAxiosError(error)) {
        logger.error(`Failed to trigger Subsonic server scan: ${ error.message }`);
      } else {
        logger.error(`Failed to trigger Subsonic server scan: ${ String(error) }`);
      }

      return false;
    }
  }
}

/** @deprecated Use SubsonicClient instead */
export const NavidromeClient = SubsonicClient;

export default SubsonicClient;
