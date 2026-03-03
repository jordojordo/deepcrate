/** GET artist.getsimilar response */
export interface LastFmSimilarArtistsResponse {
  error?:          number;
  message?:        string;
  similarartists?: {
    artist: Array<{
      name:  string;
      match: string;
      mbid?: string;
    }>;
  };
}

/** GET artist.gettoptags response */
export interface LastFmArtistTopTagsResponse {
  error?:   number;
  message?: string;
  toptags?: {
    tag: Array<{
      name:  string;
      count: number;
    }>;
  };
}
