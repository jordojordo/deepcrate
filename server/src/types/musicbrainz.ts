/**
 * Generic search results wrapper
 */
export interface SearchResults<T> {
  results: T[];
  total:   number;
}

/**
 * Recording info returned from resolveRecording
 */
export interface RecordingInfo {
  artist:            string;
  title:             string;
  mbid:              string;
  releaseGroupMbid?: string;  // For cover art lookup
}

/**
 * Album info returned from resolveRecordingToAlbum
 */
export interface AlbumInfo {
  artist:        string;
  title:         string;
  mbid:          string;  // Release-group MBID
  recordingMbid: string;
  trackTitle:    string;
  year?:         number;
}

/**
 * MusicBrainz release group (raw API shape)
 */
export interface ReleaseGroup {
  id:                    string;
  title:                 string;
  'primary-type'?:       string;
  'first-release-date'?: string;
}

/**
 * Track from a release group
 */
export interface ReleaseGroupTrack {
  title:    string;
  position: number;
}

interface MBArtistCredit {
  artist:      { name: string; id?: string };
  joinphrase?: string;
}

interface MBReleaseGroupRef {
  id:                    string;
  title:                 string;
  'primary-type'?:       string;
  'first-release-date'?: string;
}

interface MBMedia {
  'track-count'?: number;
  tracks?:        MBTrack[];
}

interface MBTrack {
  title?:     string;
  position?:  number;
  recording?: { title?: string };
}

interface MBRelease {
  id:               string;
  title:            string;
  date?:            string;
  'release-group'?: MBReleaseGroupRef;
  media?:           MBMedia[];
}

/** GET /recording/{mbid}?inc=artists+releases+release-groups */
export interface MBRecordingLookupResponse {
  title:            string;
  'artist-credit'?: MBArtistCredit[];
  releases?:        MBRelease[];
}

/** GET /release-group?query=... */
export interface MBReleaseGroupSearchResponse {
  'release-groups':      ReleaseGroup[];
  'release-group-count': number;
}

/** GET /recording?query=... */
export interface MBRecordingSearchResponse {
  recordings: Array<{
    id:               string;
    title:            string;
    'artist-credit'?: MBArtistCredit[];
    releases?:        Array<{ title: string; date?: string }>;
  }>;
  count: number;
}

/** GET /artist?query=... */
export interface MBArtistSearchResponse {
  artists: Array<{
    id:              string;
    name:            string;
    country?:        string;
    type?:           string;
    'life-span'?:    { begin?: string; end?: string };
    disambiguation?: string;
  }>;
  count: number;
}

/** GET /release?release-group=... */
export interface MBReleaseBrowseResponse {
  releases: MBRelease[];
}

/** GET /release/{id}?inc=recordings */
export interface MBReleaseLookupResponse {
  media?: MBMedia[];
}
