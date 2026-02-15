export interface SimilarArtistResult {
  name:     string;
  match:    number; // 0-1 similarity score
  mbid?:    string;
  provider: string;
}

export interface SimilarityProvider {
  name:              string;
  getSimilarArtists: (
    _artistName: string,
    _artistMbid?: string,
    _limit?: number,
    _signal?: AbortSignal
  ) => Promise<SimilarArtistResult[]>;
  isConfigured: () => boolean;
}
