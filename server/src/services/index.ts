/**
 * Service exports for DeepCrate
 */

// Types
export type { QueryContext, SearchQueryBuilderConfig } from '@server/types/search-query';
export type {
  RecordingInfo,
  AlbumInfo,
  ReleaseGroup,
} from '@server/types/musicbrainz';
export type {
  SlskdSearchResponse,
  SlskdFile,
  SlskdSearchResult,
  SlskdSearchState,
} from '@server/types/slskd-client';
export type { ListenBrainzRecommendation } from '@server/types/listenbrainz';
export type { SimilarArtist } from './clients/LastFmClient';
export type { SubsonicArtist, NavidromeArtist } from './clients/SubsonicClient';

// Core services
export { QueueService, default as QueueServiceDefault } from './QueueService';
export { WishlistService, default as WishlistServiceDefault } from './WishlistService';
export { SearchQueryBuilder, default as SearchQueryBuilderDefault } from './SearchQueryBuilder';

// API Clients
export { CoverArtArchiveClient, default as CoverArtArchiveClientDefault } from './clients/CoverArtArchiveClient';
export { ListenBrainzClient, default as ListenBrainzClientDefault } from './clients/ListenBrainzClient';
export { MusicBrainzClient, default as MusicBrainzClientDefault } from './clients/MusicBrainzClient';

export { LastFmClient, default as LastFmClientDefault } from './clients/LastFmClient';
export {
  SubsonicClient, NavidromeClient, default as SubsonicClientDefault 
} from './clients/SubsonicClient';
/** @deprecated Use SubsonicClientDefault instead */
export { default as NavidromeClientDefault } from './clients/SubsonicClient';
export { SlskdClient, default as SlskdClientDefault } from './clients/SlskdClient';

export { DeezerClient, default as DeezerClientDefault } from './clients/DeezerClient';
export { SpotifyClient, default as SpotifyClientDefault } from './clients/SpotifyClient';
export { PreviewService, default as PreviewServiceDefault } from './PreviewService';
