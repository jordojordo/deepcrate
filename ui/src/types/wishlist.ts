export interface WishlistEntry {
  artist: string;
  title:  string;
  type:   'album' | 'track';
}

export interface AddWishlistRequest {
  artist: string;
  title:  string;
  type:   'album' | 'track';
}
