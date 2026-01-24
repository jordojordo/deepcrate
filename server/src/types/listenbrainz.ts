/**
 * ListenBrainz JSPF Playlist Types
 * https://listenbrainz.readthedocs.io/en/latest/users/api/playlist.html
 */

/**
 * Playlist metadata returned from /1/user/{username}/playlists/createdfor
 */
export interface ListenBrainzPlaylistMetadata {
  identifier: string;
  title:      string;
  creator:    string;
  date:       string;
  extension: {
    'https://musicbrainz.org/doc/jspf#playlist': {
      public:      boolean;
      created_for: string;
    };
  };
}

/**
 * Response from /1/user/{username}/playlists/createdfor
 */
export interface ListenBrainzPlaylistsCreatedForResponse {
  count:     number;
  offset:    number;
  playlists: Array<{ playlist: ListenBrainzPlaylistMetadata }>;
}

/**
 * Track within a JSPF playlist
 */
export interface ListenBrainzPlaylistTrack {
  identifier: string | string[];  // Recording MBID URL(s)
  title:      string;
  creator:    string;
  album?:     string;
  extension?: {
    'https://musicbrainz.org/doc/jspf#track'?: {
      artist_identifiers?: string[];
      release_identifier?: string;
    };
  };
}

/**
 * Full playlist with tracks from /1/playlist/{playlist_mbid}
 */
export interface ListenBrainzPlaylist {
  identifier: string;
  title:      string;
  creator:    string;
  date:       string;
  track:      ListenBrainzPlaylistTrack[];
  extension?: {
    'https://musicbrainz.org/doc/jspf#playlist'?: {
      public:      boolean;
      created_for: string;
    };
  };
}

/**
 * Response from /1/playlist/{playlist_mbid}
 */
export interface ListenBrainzPlaylistResponse {
  playlist: ListenBrainzPlaylist;
}

/**
 * Response from /1/cf/recommendation/user/{username}/recording
 */
export interface ListenBrainzRecommendation {
  recording_mbid: string;
  score?:         number;
}
