export interface SearchResult {
  mbid:      string;
  title:     string;
  artist:    string;
  album?:    string | null;
  year?:     number;
  coverArt?: string;
}

export interface SearchResponse {
  results: SearchResult[];
}

export interface ArtistApiResult {
  mbid:           string;
  name:           string;
  country:        string | null;
  type:           string | null;
  beginYear:      number | null;
  endYear:        number | null;
  disambiguation: string | null;
}

export interface ApiSearchResponse {
  results: SearchResult[] | ArtistApiResult[];
}
