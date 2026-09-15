import { version } from '../../package.json';

import { getConfig } from '@server/config/settings';
import { USER_AGENT_APP_NAME, DEFAULT_CONTACT } from '@server/constants/clients';

/**
 * Build the User-Agent sent on every outbound request, in the format
 * MetaBrainz requires: `deepcrate/0.1.20 ( https://github.com/... )`.
 *
 * Agents without maintainer contact info get blocked, which is what took
 * down MusicBrainz/ListenBrainz lookups with a wall of 503s.
 * https://musicbrainz.org/doc/MusicBrainz_API/Rate_Limiting
 */
export function getUserAgent(): string {
  let contact = DEFAULT_CONTACT;

  try {
    contact = getConfig().contact || DEFAULT_CONTACT;
  } catch {
    // fall back to the repo URL rather than sending an anonymous request
  }

  return `${ USER_AGENT_APP_NAME }/${ version } ( ${ contact } )`;
}
