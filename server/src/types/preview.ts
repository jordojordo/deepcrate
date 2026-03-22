import { z } from 'zod';

/**
 * Zod schema for preview query parameters
 */
export const previewQuerySchema = z.object({
  artist: z.string().min(1),
  track:  z.string().min(1),
});

/**
 * Zod schema for album preview query parameters
 */
export const albumPreviewQuerySchema = z.object({
  artist:      z.string().min(1),
  album:       z.string().min(1),
  mbid:        z.string().optional(),
  sourceTrack: z.string().optional(),
});

export type AlbumPreviewQuery = z.infer<typeof albumPreviewQuerySchema>;

/**
 * Preview response
 */
export interface PreviewResponse {
  url:       string | null;
  source:    'deezer' | 'spotify' | null;
  available: boolean;
}

/**
 * Selected album track from track selection
 */
export interface SelectedAlbumTrack {
  title:      string;
  artist:     string;
  previewUrl: string | null;
  source:     'spotify' | 'deezer' | 'musicbrainz';
}

/**
 * Album preview response (extends PreviewResponse with selected track info)
 */
export interface AlbumPreviewResponse extends PreviewResponse {
  selectedTrack: string | null;
}

/**
 * Deezer API types
 */
export interface DeezerSearchResult {
  id:       number;
  title:    string;
  preview:  string;
  artist:   { id: number; name: string };
  album:    { id: number; title: string; cover_medium?: string };
  duration: number;
}

export interface DeezerSearchResponse {
  data:  DeezerSearchResult[];
  total: number;
}

/**
 * Spotify API types
 */
export interface SpotifyTokenResponse {
  access_token: string;
  token_type:   string;
  expires_in:   number;
}

export interface SpotifyTrack {
  id:          string;
  name:        string;
  preview_url: string | null;
  artists:     { id: string; name: string }[];
  album:       { id: string; name: string; images: { url: string; width: number; height: number }[] };
  duration_ms: number;
}

export interface SpotifySearchResponse {
  tracks: {
    items: SpotifyTrack[];
    total: number;
  };
}

export interface SpotifyAlbumSearchResponse {
  albums: {
    items: SpotifyAlbum[];
    total: number;
  };
}

export interface SpotifyAlbum {
  id:           string;
  name:         string;
  artists:      { id: string; name: string }[];
  images:       { url: string; width: number; height: number }[];
  release_date: string;
  total_tracks: number;
}

export interface SpotifyAlbumTrack {
  id:           string;
  name:         string;
  preview_url:  string | null;
  artists:      { id: string; name: string }[];
  duration_ms:  number;
  track_number: number;
}

export interface SpotifyAlbumTracksResponse {
  items: SpotifyAlbumTrack[];
  total: number;
}

/**
 * Deezer album types
 */
export interface DeezerAlbumSearchResult {
  id:            number;
  title:         string;
  artist:        { id: number; name: string };
  cover_medium?: string;
  nb_tracks:     number;
}

export interface DeezerAlbumSearchResponse {
  data:  DeezerAlbumSearchResult[];
  total: number;
}

export interface DeezerAlbumTrack {
  id:             number;
  title:          string;
  preview:        string;
  artist:         { id: number; name: string };
  duration:       number;
  track_position: number;
}

export interface DeezerAlbumTracksResponse {
  data:  DeezerAlbumTrack[];
  total: number;
}
