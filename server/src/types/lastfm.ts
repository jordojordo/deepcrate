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
