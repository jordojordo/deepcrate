import type { PartialBy } from '@sequelize/utils';
import { DataTypes, Model } from '@sequelize/core';
import { sequelize } from '@server/config/db/sequelize';

/**
 * Status of a download task in the download workflow
 */
export type DownloadTaskStatus = 'pending' | 'searching' | 'deferred' | 'queued' | 'downloading' | 'completed' | 'failed';

/**
 * Type of music item (album or track)
 */
export type DownloadTaskType = 'album' | 'track';

/**
 * DownloadTask attributes for tracking download lifecycle.
 * Tracks items from wishlist through slskd download to completion.
 */
export interface DownloadTaskAttributes {
  id:              string;           // UUID
  wishlistKey:     string;           // Format: "artist - album" (unique)
  artist:          string;
  album:           string;
  type:            DownloadTaskType;
  status:          DownloadTaskStatus;
  organizedAt?:    Date;             // When moved to library
  slskdSearchId?:  string;           // Search ID from slskd
  slskdUsername?:  string;           // Source user for downloads
  slskdDirectory?: string;           // Directory path on source
  slskdFileIds?:   string[];         // Transfer file IDs from slskd enqueue response
  fileCount?:      number;           // Total files in download
  errorMessage?:   string;           // Error details for failed status
  retryCount:      number;           // Number of retry attempts
  queuedAt:        Date;             // When added to download queue
  startedAt?:      Date;             // When download actually started
  completedAt?:    Date;             // When finished (success or fail)
  createdAt?:      Date;
  updatedAt?:      Date;
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
  declare id:              string;
  declare wishlistKey:     string;
  declare artist:          string;
  declare album:           string;
  declare type:            DownloadTaskType;
  declare status:          DownloadTaskStatus;
  declare organizedAt?:    Date;
  declare slskdSearchId?:  string;
  declare slskdUsername?:  string;
  declare slskdDirectory?: string;
  declare slskdFileIds?:   string[];
  declare fileCount?:      number;
  declare errorMessage?:   string;
  declare retryCount:      number;
  declare queuedAt:        Date;
  declare startedAt?:      Date;
  declare completedAt?:    Date;
  declare createdAt?:      Date;
  declare updatedAt?:      Date;
}

DownloadTask.init(
  {
    id: {
      type:         DataTypes.UUID,
      primaryKey:   true,
      defaultValue: DataTypes.UUIDV4,
    },
    wishlistKey: {
      type:       DataTypes.STRING(1000),
      allowNull:  false,
      unique:     true,
      columnName: 'wishlist_key',
      comment:    'Unique key from wishlist (format: "artist - album")',
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
    organizedAt: {
      type:       DataTypes.DATE,
      allowNull:  true,
      columnName: 'organized_at',
      comment:    'When this download was organized into the library',
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
      // Note: wishlist_key already has unique constraint at column level
    ],
  },
);

export default DownloadTask;
