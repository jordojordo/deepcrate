import { z } from 'zod';

/**
 * MusicBrainz search query params schema
 */
export const musicBrainzSearchQuerySchema = z.object({
  q:     z.string().min(1, 'Search query is required'),
  type:  z.enum(['album', 'artist']),
  limit: z.coerce.number().int().positive().max(100)
    .default(20),
});

export type MusicBrainzSearchQuery = z.infer<typeof musicBrainzSearchQuerySchema>;

/**
 * Album search result schema
 */
export const albumSearchResultSchema = z.object({
  mbid:   z.string(),
  title:  z.string(),
  artist: z.string(),
  type:   z.string().nullable(),
  year:   z.number().int().nullable(),
});

export type AlbumSearchResult = z.infer<typeof albumSearchResultSchema>;

/**
 * Artist search result schema
 */
export const artistSearchResultSchema = z.object({
  mbid:           z.string(),
  name:           z.string(),
  country:        z.string().nullable(),
  type:           z.string().nullable(),
  beginYear:      z.number().int().nullable(),
  endYear:        z.number().int().nullable(),
  disambiguation: z.string().nullable(),
});

export type ArtistSearchResult = z.infer<typeof artistSearchResultSchema>;

/**
 * MusicBrainz search response schema
 */
export const musicBrainzSearchResponseSchema = z.object({
  query:   z.string(),
  type:    z.enum(['album', 'artist']),
  results: z.array(z.union([albumSearchResultSchema, artistSearchResultSchema])),
  total:   z.number().int().nonnegative(),
});

export type MusicBrainzSearchResponse = z.infer<typeof musicBrainzSearchResponseSchema>;
