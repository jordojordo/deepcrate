import type { SearchResult } from '@/types/search';

import client from './api';

export interface SearchResponse {
  results: SearchResult[];
}

export async function searchMusicBrainz(
  query: string,
  type: 'album' | 'artist',
  limit = 20
): Promise<SearchResponse> {
  const response = await client.get<SearchResponse>('/search/musicbrainz', {
    params: {
      q: query, type, limit 
    },
  });

  return response.data;
}
