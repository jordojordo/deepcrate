/**
 * Model exports for DeepCrate
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

export { default as DownloadTask } from './DownloadTask';
export type {
  DownloadTaskAttributes,
  DownloadTaskCreationAttributes,
  DownloadTaskStatus,
  DownloadTaskType,
} from './DownloadTask';

export { default as LibraryAlbum } from './LibraryAlbum';
export type {
  LibraryAlbumAttributes,
  LibraryAlbumCreationAttributes,
} from './LibraryAlbum';

export { default as WishlistItem } from './WishlistItem';
export type {
  WishlistItemAttributes,
  WishlistItemCreationAttributes,
  WishlistItemType,
  WishlistItemSource,
} from './WishlistItem';
