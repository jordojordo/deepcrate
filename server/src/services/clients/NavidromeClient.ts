import axios from 'axios';
import crypto from 'crypto';
import logger from '@server/config/logger';

export interface NavidromeArtist {
  name: string;
  id:   string;
}

/**
 * NavidromeClient provides access to Navidrome via Subsonic API.
 * https://www.subsonic.org/pages/api.jsp
 */
export class NavidromeClient {
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
   * Get all artists from Navidrome library
   */
  async getArtists(): Promise<Record<string, NavidromeArtist>> {
    const salt = 'catalogdisc';
    const token = this.md5Hash(this.password + salt);

    const params = {
      u: this.username,
      t: token,
      s: salt,
      v: '1.16.1',
      c: 'resonance',
      f: 'json',
    };

    const url = `${ this.host }/rest/getArtists`;

    try {
      logger.info(`Fetching artists from Navidrome at ${ this.host }...`);

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
      const artists: Record<string, NavidromeArtist> = {};
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
        logger.error(`Failed to fetch artists from Navidrome: ${ error.message }`);
      } else {
        logger.error(`Failed to fetch artists from Navidrome: ${ String(error) }`);
      }

      return {};
    }
  }
}

export default NavidromeClient;
