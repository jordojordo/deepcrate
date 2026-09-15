/**
 * Identity sent in the User-Agent header on every outbound request.
 * MetaBrainz blocks agents without maintainer contact info, so the contact
 * must be a reachable URL or email.
 * https://musicbrainz.org/doc/MusicBrainz_API/Rate_Limiting
 */
export const USER_AGENT_APP_NAME = 'deepcrate';
export const DEFAULT_CONTACT = 'https://github.com/jordojordo/deepcrate';

export const DEEZER_BASE_URL = 'https://api.deezer.com';
export const SPOTIFY_AUTH_URL = 'https://accounts.spotify.com/api/token';
export const SPOTIFY_API_URL = 'https://api.spotify.com/v1';
export const MB_BASE_URL = 'https://musicbrainz.org/ws/2';
export const LB_BASE_URL = 'https://api.listenbrainz.org/1';
export const LASTFM_BASE_URL = 'https://ws.audioscrobbler.com/2.0/';
export const COVER_ART_ARCHIVE_BASE_URL = 'https://coverartarchive.org';
