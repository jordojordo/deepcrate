import type { PartialBy } from '@sequelize/utils';
import type { QualityTier } from '@server/types/slskd';

import { DataTypes, Model, sql } from '@sequelize/core';
import { sequelize } from '@server/config/db/sequelize';

/**
 * Status of a download task in the download workflow
 */
export type DownloadTaskStatus =
  'pending' | 'searching' | 'pending_selection' | 'deferred' |
  'queued' | 'downloading' | 'completed' | 'failed';

/**
 * Type of music item (album or track)
 */
export type DownloadTaskType = 'album' | 'track';

/**
 * DownloadTask attributes for tracking download lifecycle.
 * Tracks items from wishlist through slskd download to completion.
 */
export interface DownloadTaskAttributes {
  id:                  string;           // UUID
  wishlistKey:         string;           // Format: "artist - album" (unique) - @deprecated use wishlistItemId
  wishlistItemId?:     string;           // UUID FK to WishlistItem
  artist:              string;
  album:               string;
  type:                DownloadTaskType;
  status:              DownloadTaskStatus;
  year?:               number;           // Release year for search queries
  organizedAt?:        Date;             // When moved to library
  downloadPath?:       string;           // Relative path under downloads root
  slskdSearchId?:      string;           // Search ID from slskd
  slskdUsername?:      string;           // Source user for downloads
  slskdDirectory?:     string;           // Directory path on source
  slskdFileIds?:       string[];         // Transfer file IDs from slskd enqueue response
  fileCount?:          number;           // Total files in download
  qualityFormat?:      string;           // Detected audio format (flac, mp3, etc.)
  qualityBitRate?:     number;           // Average bitrate in kbps
  qualityBitDepth?:    number;           // Bit depth (16, 24, etc.)
  qualitySampleRate?:  number;           // Sample rate in Hz
  qualityTier?:        QualityTier;      // Quality tier (lossless, high, standard, low)
  searchResults?:      string;           // Cached SlskdSearchResponse[] as JSON
  searchQuery?:        string;           // Query used for search (for editing/retry)
  selectionExpiresAt?: Date;             // When selection times out
  skippedUsernames?:   string[];         // Usernames skipped for this download
  errorMessage?:       string;           // Error details for failed status
  retryCount:          number;           // Number of retry attempts
  queuedAt:            Date;             // When added to download queue
  startedAt?:          Date;             // When download actually started
  completedAt?:        Date;             // When finished (success or fail)
  createdAt?:          Date;
  updatedAt?:          Date;
}

export type DownloadTaskCreationAttributes = PartialBy<
  DownloadTaskAttributes,
  'id' | 'status' | 'retryCount' | 'queuedAt'
>;

/**
 * Sequelize model for download tasks.
 * Represents items being downloaded via slskd with full lifecycle tracking.
 */
class DownloadTask extends Model<DownloadTaskAttributes, DownloadTaskCreationAttributes> implements DownloadTaskAttributes {
  declare id:                  string;
  declare wishlistKey:         string;
  declare wishlistItemId?:     string;
  declare artist:              string;
  declare album:               string;
  declare type:                DownloadTaskType;
  declare status:              DownloadTaskStatus;
  declare year?:               number;
  declare organizedAt?:        Date;
  declare downloadPath?:       string;
  declare slskdSearchId?:      string;
  declare slskdUsername?:      string;
  declare slskdDirectory?:     string;
  declare slskdFileIds?:       string[];
  declare fileCount?:          number;
  declare qualityFormat?:      string;
  declare qualityBitRate?:     number;
  declare qualityBitDepth?:    number;
  declare qualitySampleRate?:  number;
  declare qualityTier?:        QualityTier;
  declare searchResults?:      string;
  declare searchQuery?:        string;
  declare selectionExpiresAt?: Date;
  declare skippedUsernames?:   string[];
  declare errorMessage?:       string;
  declare retryCount:          number;
  declare queuedAt:            Date;
  declare startedAt?:          Date;
  declare completedAt?:        Date;
  declare createdAt?:          Date;
  declare updatedAt?:          Date;
}

DownloadTask.init(
  {
    id: {
      type:         DataTypes.UUID,
      primaryKey:   true,
      defaultValue: sql.uuidV4,
    },
    wishlistKey: {
      type:       DataTypes.STRING(1000),
      allowNull:  false,
      unique:     true,
      columnName: 'wishlist_key',
      comment:    '@deprecated Use wishlistItemId FK instead. Unique key from wishlist (format: "artist - album")',
    },
    wishlistItemId: {
      type:       DataTypes.UUID,
      allowNull:  true,
      columnName: 'wishlist_item_id',
      comment:    'FK to wishlist_items table',
    },
    artist: {
      type:      DataTypes.STRING(500),
      allowNull: false,
    },
    album: {
      type:      DataTypes.STRING(500),
      allowNull: false,
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
    year: {
      type:      DataTypes.INTEGER,
      allowNull: true,
      comment:   'Release year for search query templates',
    },
    organizedAt: {
      type:       DataTypes.DATE,
      allowNull:  true,
      columnName: 'organized_at',
      comment:    'When this download was organized into the library',
    },
    downloadPath: {
      type:       DataTypes.STRING(2000),
      allowNull:  true,
      columnName: 'download_path',
      comment:    'Relative path under the downloads root for this task',
    },
    slskdSearchId: {
      type:       DataTypes.STRING(255),
      allowNull:  true,
      columnName: 'slskd_search_id',
      comment:    'Search ID from slskd API',
    },
    slskdUsername: {
      type:       DataTypes.STRING(255),
      allowNull:  true,
      columnName: 'slskd_username',
      comment:    'Soulseek username providing the files',
    },
    slskdDirectory: {
      type:       DataTypes.STRING(2000),
      allowNull:  true,
      columnName: 'slskd_directory',
      comment:    'Directory path on the source user',
    },
    slskdFileIds: {
      type:       DataTypes.JSON,
      allowNull:  true,
      columnName: 'slskd_file_ids',
      comment:    'Transfer file IDs from slskd enqueue response',
    },
    fileCount: {
      type:       DataTypes.INTEGER,
      allowNull:  true,
      columnName: 'file_count',
      comment:    'Total number of files in the download',
    },
    qualityFormat: {
      type:       DataTypes.STRING(20),
      allowNull:  true,
      columnName: 'quality_format',
      comment:    'Detected audio format (flac, mp3, etc.)',
    },
    qualityBitRate: {
      type:       DataTypes.INTEGER,
      allowNull:  true,
      columnName: 'quality_bit_rate',
      comment:    'Average bitrate in kbps',
    },
    qualityBitDepth: {
      type:       DataTypes.INTEGER,
      allowNull:  true,
      columnName: 'quality_bit_depth',
      comment:    'Bit depth (16, 24, etc.)',
    },
    qualitySampleRate: {
      type:       DataTypes.INTEGER,
      allowNull:  true,
      columnName: 'quality_sample_rate',
      comment:    'Sample rate in Hz',
    },
    qualityTier: {
      type:       DataTypes.STRING(20),
      allowNull:  true,
      columnName: 'quality_tier',
      comment:    'Quality tier (lossless, high, standard, low, unknown)',
    },
    searchResults: {
      type:       DataTypes.TEXT,
      allowNull:  true,
      columnName: 'search_results',
      comment:    'Cached SlskdSearchResponse[] as JSON for manual selection',
    },
    searchQuery: {
      type:       DataTypes.STRING(500),
      allowNull:  true,
      columnName: 'search_query',
      comment:    'Query used for search (for editing/retry)',
    },
    selectionExpiresAt: {
      type:       DataTypes.DATE,
      allowNull:  true,
      columnName: 'selection_expires_at',
      comment:    'When selection times out (null = no timeout)',
    },
    skippedUsernames: {
      type:       DataTypes.JSON,
      allowNull:  true,
      columnName: 'skipped_usernames',
      comment:    'Usernames skipped for this download',
    },
    errorMessage: {
      type:       DataTypes.TEXT,
      allowNull:  true,
      columnName: 'error_message',
      comment:    'Error details when status is failed',
    },
    retryCount: {
      type:         DataTypes.INTEGER,
      allowNull:    false,
      defaultValue: 0,
      columnName:   'retry_count',
      comment:      'Number of retry attempts',
    },
    queuedAt: {
      type:         DataTypes.DATE,
      allowNull:    false,
      defaultValue: DataTypes.NOW,
      columnName:   'queued_at',
      comment:      'When added to download queue',
    },
    startedAt: {
      type:       DataTypes.DATE,
      allowNull:  true,
      columnName: 'started_at',
      comment:    'When download actually started',
    },
    completedAt: {
      type:       DataTypes.DATE,
      allowNull:  true,
      columnName: 'completed_at',
      comment:    'When finished (success or fail)',
    },
  },
  {
    sequelize,
    tableName:   'download_tasks',
    underscored: true,
    indexes:     [
      { fields: ['status'] },
      { fields: ['organized_at'] },
      { fields: ['queued_at'] },
      { fields: ['wishlist_item_id'] },
      { fields: ['status', 'selection_expires_at'] }, // Composite for expiration queries
      // Note: wishlist_key already has unique constraint at column level
    ],
  },
);

export default DownloadTask;
