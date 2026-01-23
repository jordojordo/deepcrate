import type { ApiSearchResponse, ArtistApiResult, SearchResponse, SearchResult } from '@/types/search';

import client from './api';

function normalizeArtistResults(results: ArtistApiResult[]): SearchResult[] {
  return results.map((artist) => ({
    mbid:   artist.mbid,
    artist: artist.name,
    title:  artist.type || 'Artist',
    year:   artist.beginYear ?? undefined,
  }));
}

export async function searchMusicBrainz(
  query: string,
  type: 'album' | 'artist' | 'track',
  limit = 20
): Promise<SearchResponse> {
  const response = await client.get<ApiSearchResponse>('/search/musicbrainz', {
    params: {
      q: query, type, limit
    },
  });

  if (type === 'artist') {
    return { results: normalizeArtistResults(response.data.results as ArtistApiResult[]) };
  }

  return response.data as SearchResponse;
}
