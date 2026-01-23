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
