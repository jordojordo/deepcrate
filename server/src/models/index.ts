/**
 * Model exports for Resonance
 */

export { default as QueueItem } from './QueueItem';
export type {
  QueueItemAttributes,
  QueueItemCreationAttributes,
  QueueItemStatus,
  QueueItemType,
  QueueItemSource,
} from './QueueItem';

export { default as ProcessedRecording } from './ProcessedRecording';
export type {
  ProcessedRecordingAttributes,
  ProcessedRecordingCreationAttributes,
} from './ProcessedRecording';

export { default as CatalogArtist } from './CatalogArtist';
export type {
  CatalogArtistAttributes,
  CatalogArtistCreationAttributes,
} from './CatalogArtist';

export { default as DiscoveredArtist } from './DiscoveredArtist';
export type {
  DiscoveredArtistAttributes,
  DiscoveredArtistCreationAttributes,
} from './DiscoveredArtist';

export { default as DownloadedItem } from './DownloadedItem';
export type {
  DownloadedItemAttributes,
  DownloadedItemCreationAttributes,
} from './DownloadedItem';
