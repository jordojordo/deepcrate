export interface QueueItem {
  artist:        string;
  album?:        string;
  title?:        string;
  mbid:          string;
  type:          'album' | 'track';
  added_at:      string;
  score?:        number;
  source:        'listenbrainz' | 'catalog';
  similar_to?:   string[];
  source_track?: string;
  cover_url?:    string;
  year?:         number;
  in_library?:   boolean;
}

export interface QueueFilters {
  source:           'all' | 'listenbrainz' | 'catalog';
  sort:             'added_at' | 'score' | 'artist' | 'year';
  order:            'asc' | 'desc';
  limit:            number;
  offset:           number;
  hide_in_library?: boolean;
}

export interface ApproveRequest {
  mbids: string[];
}

export interface RejectRequest {
  mbids: string[];
}

export interface QueueStats {
  pending:        number;
  approved:       number;
  rejected:       number;
  inLibrary:      number;
  approvedToday:  number;
  totalProcessed: number;
}
