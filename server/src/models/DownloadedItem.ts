import type { PartialBy } from '@sequelize/utils';
import { DataTypes, Model } from '@sequelize/core';
import { sequelize } from '@server/config/db/sequelize';

/**
 * DownloadedItem attributes.
 * Tracks items that have been sent to slskd for download
 * to prevent duplicate download requests.
 *
 * @deprecated This model is replaced by WishlistItem.processedAt.
 * Retained for backward compatibility during migration.
 * Will be removed in a future version.
 */
export interface DownloadedItemAttributes {
  id:           number;
  wishlistKey:  string;  // Format: "artist - album" or "artist - title"
  downloadedAt: Date;
  createdAt?:   Date;
  updatedAt?:   Date;
}

export type DownloadedItemCreationAttributes = PartialBy<DownloadedItemAttributes, 'id' | 'downloadedAt'>;

/**
 * Sequelize model for downloaded items.
 * Prevents slskd-downloader from requesting the same item multiple times.
 *
 * @deprecated This model is replaced by WishlistItem.processedAt.
 * Retained for backward compatibility during migration.
 * Will be removed in a future version.
 */
class DownloadedItem extends Model<DownloadedItemAttributes, DownloadedItemCreationAttributes> implements DownloadedItemAttributes {
  declare id:           number;
  declare wishlistKey:  string;
  declare downloadedAt: Date;
  declare createdAt?:   Date;
  declare updatedAt?:   Date;
}

DownloadedItem.init(
  {
    id: {
      type:          DataTypes.INTEGER,
      primaryKey:    true,
      autoIncrement: true,
    },
    wishlistKey: {
      type:       DataTypes.STRING(1000),
      allowNull:  false,
      unique:     true,
      columnName: 'wishlist_key',
      comment:    'Unique key from wishlist.txt (format: "artist - album")',
    },
    downloadedAt: {
      type:         DataTypes.DATE,
      allowNull:    false,
      defaultValue: DataTypes.NOW,
      columnName:   'downloaded_at',
    },
  },
  {
    sequelize,
    tableName:   'downloaded_items',
    underscored: true,
    indexes:     [
      // Note: wishlist_key already has unique constraint at column level (line 42)
    ],
  },
);

export default DownloadedItem;
