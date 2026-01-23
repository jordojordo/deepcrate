import type { PartialBy } from '@sequelize/utils';

import { DataTypes, Model, sql } from '@sequelize/core';
import { sequelize } from '@server/config/db/sequelize';

/**
 * Type of wishlist item (artist, album, or track)
 */
export type WishlistItemType = 'artist' | 'album' | 'track';

/**
 * Source of the wishlist entry
 */
export type WishlistItemSource = 'listenbrainz' | 'catalog' | 'manual';

/**
 * WishlistItem attributes for the wishlist database table.
 * Replaces wishlist.txt file and consolidates DownloadedItem functionality.
 */
export interface WishlistItemAttributes {
  id:           string;              // UUID primary key
  artist:       string;              // Max 500 chars
  album:        string;              // Album or track title
  type:         WishlistItemType;
  year?:        number | null;       // From QueueItem
  mbid?:        string | null;       // MusicBrainz ID
  source?:      WishlistItemSource | null;  // 'listenbrainz' | 'catalog' | 'manual'
  coverUrl?:    string | null;       // Cover art URL
  addedAt:      Date;                // When added to wishlist
  processedAt?: Date | null;         // When download task was created (replaces DownloadedItem)
  createdAt?:   Date;
  updatedAt?:   Date;
}

export type WishlistItemCreationAttributes = PartialBy<
  WishlistItemAttributes,
  'id' | 'addedAt'
>;

/**
 * Sequelize model for wishlist items.
 * Stores items awaiting download or already processed.
 * Replaces the wishlist.txt file for persistent storage.
 */
class WishlistItem extends Model<WishlistItemAttributes, WishlistItemCreationAttributes> implements WishlistItemAttributes {
  declare id:           string;
  declare artist:       string;
  declare album:        string;
  declare type:         WishlistItemType;
  declare year?:        number | null;
  declare mbid?:        string | null;
  declare source?:      WishlistItemSource | null;
  declare coverUrl?:    string | null;
  declare addedAt:      Date;
  declare processedAt?: Date | null;
  declare createdAt?:   Date;
  declare updatedAt?:   Date;
}

WishlistItem.init(
  {
    id: {
      type:         DataTypes.UUID,
      primaryKey:   true,
      defaultValue: sql.uuidV4,
    },
    artist: {
      type:      DataTypes.STRING(500),
      allowNull: false,
    },
    album: {
      type:      DataTypes.STRING(500),
      allowNull: false,
      comment:   'Album name or track title',
    },
    type: {
      type:         DataTypes.STRING(20),
      allowNull:    false,
      defaultValue: 'album',
    },
    year: {
      type:      DataTypes.INTEGER,
      allowNull: true,
      comment:   'Release year from QueueItem',
    },
    mbid: {
      type:      DataTypes.STRING(255),
      allowNull: true,
      comment:   'MusicBrainz ID from QueueItem',
    },
    source: {
      type:      DataTypes.STRING(50),
      allowNull: true,
      comment:   'Source of discovery: listenbrainz, catalog, or manual',
    },
    coverUrl: {
      type:       DataTypes.STRING(1000),
      allowNull:  true,
      columnName: 'cover_url',
      comment:    'Cover art URL from QueueItem',
    },
    addedAt: {
      type:         DataTypes.DATE,
      allowNull:    false,
      defaultValue: DataTypes.NOW,
      columnName:   'added_at',
      comment:      'When this item was added to the wishlist',
    },
    processedAt: {
      type:       DataTypes.DATE,
      allowNull:  true,
      columnName: 'processed_at',
      comment:    'When a download task was created for this item',
    },
  },
  {
    sequelize,
    tableName:   'wishlist_items',
    underscored: true,
    indexes:     [
      { fields: ['added_at'] },
      { fields: ['processed_at'] },
      { fields: ['source'] },
      // Composite unique constraint on (artist, album, type)
      {
        unique: true,
        fields: ['artist', 'album', 'type'],
        name:   'wishlist_items_artist_album_type_unique',
      },
    ],
  },
);

export default WishlistItem;
