import type { PartialBy } from '@sequelize/utils';
import { DataTypes, Model } from '@sequelize/core';
import { sequelize } from '@server/config/db/sequelize';

/**
 * Status of a queue item in the approval workflow
 */
export type QueueItemStatus = 'pending' | 'approved' | 'rejected';

/**
 * Type of music item (album or track)
 */
export type QueueItemType = 'album' | 'track';

/**
 * Source of the discovery
 */
export type QueueItemSource = 'listenbrainz' | 'catalog';

/**
 * QueueItem attributes for the unified approval queue.
 * Combines ListenBrainz recommendations and catalog discoveries.
 */
export interface QueueItemAttributes {
  id:           number;
  artist:       string;
  album?:       string;         // For album mode
  title?:       string;         // For track mode or source track reference
  mbid:         string;         // MusicBrainz ID (unique - release-group or recording)
  type:         QueueItemType;  // 'album' or 'track'
  status:       QueueItemStatus;
  score?:       number;         // Recommendation score (0-1)
  source:       QueueItemSource;
  similarTo?:   string[];       // For catalog: list of library artists this is similar to
  sourceTrack?: string;        // For albums: the track that led to this recommendation
  coverUrl?:    string;         // Cover art URL
  year?:        number;         // Release year
  addedAt:      Date;
  processedAt?: Date;          // When approved/rejected
  createdAt?:   Date;
  updatedAt?:   Date;
}

export type QueueItemCreationAttributes = PartialBy<QueueItemAttributes, 'id' | 'status' | 'addedAt'>;

/**
 * Sequelize model for queue items.
 * Represents music recommendations waiting for approval or already approved/rejected.
 */
class QueueItem extends Model<QueueItemAttributes, QueueItemCreationAttributes> implements QueueItemAttributes {
  declare id:           number;
  declare artist:       string;
  declare album?:       string;
  declare title?:       string;
  declare mbid:         string;
  declare type:         QueueItemType;
  declare status:       QueueItemStatus;
  declare score?:       number;
  declare source:       QueueItemSource;
  declare similarTo?:   string[];
  declare sourceTrack?: string;
  declare coverUrl?:    string;
  declare year?:        number;
  declare addedAt:      Date;
  declare processedAt?: Date;
  declare createdAt?:   Date;
  declare updatedAt?:   Date;
}

QueueItem.init(
  {
    id: {
      type:          DataTypes.INTEGER,
      primaryKey:    true,
      autoIncrement: true,
    },
    artist: {
      type:      DataTypes.STRING(500),
      allowNull: false,
    },
    album: {
      type:      DataTypes.STRING(500),
      allowNull: true,
    },
    title: {
      type:      DataTypes.STRING(500),
      allowNull: true,
    },
    mbid: {
      type:      DataTypes.STRING(255),
      allowNull: false,
      unique:    true,
      comment:   'MusicBrainz ID - unique identifier for deduplication',
    },
    type: {
      type:         DataTypes.STRING(20),
      allowNull:    false,
      defaultValue: 'album',
    },
    status: {
      type:         DataTypes.STRING(20),
      allowNull:    false,
      defaultValue: 'pending',
    },
    score: {
      type:      DataTypes.DOUBLE,
      allowNull: true,
      comment:   'Recommendation score (0-1)',
    },
    source: {
      type:      DataTypes.STRING(50),
      allowNull: false,
    },
    similarTo: {
      type:       DataTypes.JSON,
      allowNull:  true,
      columnName: 'similar_to',
      comment:    'List of library artists this is similar to (for catalog discoveries)',
    },
    sourceTrack: {
      type:       DataTypes.STRING(500),
      allowNull:  true,
      columnName: 'source_track',
      comment:    'Track title that led to this album recommendation',
    },
    coverUrl: {
      type:       DataTypes.STRING(1000),
      allowNull:  true,
      columnName: 'cover_url',
    },
    year: {
      type:      DataTypes.INTEGER,
      allowNull: true,
    },
    addedAt: {
      type:         DataTypes.DATE,
      allowNull:    false,
      defaultValue: DataTypes.NOW,
      columnName:   'added_at',
    },
    processedAt: {
      type:       DataTypes.DATE,
      allowNull:  true,
      columnName: 'processed_at',
    },
  },
  {
    sequelize,
    tableName:   'queue_items',
    underscored: true,
    indexes:     [
      { fields: ['status'] },
      { fields: ['source'] },
      { fields: ['added_at'] },
      // Note: mbid already has unique constraint at column level (line 92)
    ],
  },
);

export default QueueItem;
