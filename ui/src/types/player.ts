import type { QueueItem } from './queue';

export interface PreviewTrack {
  id:           string;
  artist:       string;
  title:        string;
  album?:       string;
  coverUrl?:    string;
  type:         'album' | 'track';
  mbid?:        string;
  sourceTrack?: string;
}

export interface PreviewResponse {
  url:       string | null;
  source:    'deezer' | 'spotify' | null;
  available: boolean;
}

export interface AlbumPreviewResponse extends PreviewResponse {
  selectedTrack: string | null;
}

export interface PlayerState {
  currentTrack: PreviewTrack | null;
  isPlaying:    boolean;
  isLoading:    boolean;
  currentTime:  number;
  duration:     number;
  volume:       number;
  isMuted:      boolean;
  error:        string | null;
  source:       'deezer' | 'spotify' | null;
}

export interface GetPreviewParams {
  artist: string;
  track:  string;
}

export interface GetAlbumPreviewParams {
  artist:       string;
  album:        string;
  mbid?:        string;
  sourceTrack?: string;
}

/**
 * Convert a QueueItem to a PreviewTrack
 */
export function queueItemToPreviewTrack(item: QueueItem): PreviewTrack {
  return {
    id:          item.mbid,
    artist:      item.artist,
    title:       item.title || item.album || 'Unknown Track',
    album:       item.album,
    coverUrl:    item.cover_url,
    type:        item.type,
    mbid:        item.mbid,
    sourceTrack: item.source_track,
  };
}
