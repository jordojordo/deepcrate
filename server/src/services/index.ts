/**
 * Service exports for Resonance
 */

// Core services
export { QueueService, default as QueueServiceDefault } from './QueueService';
export { WishlistService, default as WishlistServiceDefault } from './WishlistService';

// API Clients
export { CoverArtArchiveClient, default as CoverArtArchiveClientDefault } from './clients/CoverArtArchiveClient';
export { ListenBrainzClient, default as ListenBrainzClientDefault } from './clients/ListenBrainzClient';
export type { ListenBrainzRecommendation } from './clients/ListenBrainzClient';
export { MusicBrainzClient, default as MusicBrainzClientDefault } from './clients/MusicBrainzClient';
export type {
  RecordingInfo,
  AlbumInfo,
  ReleaseGroup,
} from './clients/MusicBrainzClient';
export { LastFmClient, default as LastFmClientDefault } from './clients/LastFmClient';
export type { SimilarArtist } from './clients/LastFmClient';
export { NavidromeClient, default as NavidromeClientDefault } from './clients/NavidromeClient';
export type { NavidromeArtist } from './clients/NavidromeClient';
export { SlskdClient, default as SlskdClientDefault } from './clients/SlskdClient';
export type {
  SlskdSearchResponse,
  SlskdFile,
  SlskdSearchResult,
  SlskdSearchState,
} from './clients/SlskdClient';
