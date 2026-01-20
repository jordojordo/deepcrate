export interface WishlistEntry {
  id:           string;
  artist:       string;
  title:        string;
  type:         'album' | 'track';
  year?:        number | null;
  mbid?:        string | null;
  source?:      'listenbrainz' | 'catalog' | 'manual' | null;
  coverUrl?:    string | null;
  addedAt:      string;
  processedAt?: string | null;
}

export interface AddWishlistRequest {
  artist: string;
  title:  string;
  type:   'album' | 'track';
  year?:  number;
  mbid?:  string;
}
