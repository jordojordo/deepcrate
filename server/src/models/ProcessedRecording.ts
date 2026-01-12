import type { PartialBy } from '@sequelize/utils';
import { DataTypes, Model } from '@sequelize/core';
import { sequelize } from '@server/config/db/sequelize';

/**
 * ProcessedRecording attributes.
 * Tracks which MusicBrainz recordings/release-groups have been processed
 * to prevent duplicate recommendations.
 */
export interface ProcessedRecordingAttributes {
  id:          number;
  mbid:        string;  // MusicBrainz ID (recording or release-group)
  source:      string;  // Source that processed it ('listenbrainz', 'catalog')
  processedAt: Date;
  createdAt?:  Date;
  updatedAt?:  Date;
}

export type ProcessedRecordingCreationAttributes = PartialBy<ProcessedRecordingAttributes, 'id' | 'processedAt'>;

/**
 * Sequelize model for processed recordings.
 * Maintains a history of which MBIDs have been processed to prevent duplicates.
 */
class ProcessedRecording extends Model<ProcessedRecordingAttributes, ProcessedRecordingCreationAttributes> implements ProcessedRecordingAttributes {
  declare id:          number;
  declare mbid:        string;
  declare source:      string;
  declare processedAt: Date;
  declare createdAt?:  Date;
  declare updatedAt?:  Date;
}

ProcessedRecording.init(
  {
    id: {
      type:          DataTypes.INTEGER,
      primaryKey:    true,
      autoIncrement: true,
    },
    mbid: {
      type:      DataTypes.STRING(255),
      allowNull: false,
      unique:    true,
      comment:   'MusicBrainz ID - unique identifier',
    },
    source: {
      type:      DataTypes.STRING(50),
      allowNull: false,
      comment:   'Discovery source that processed this MBID',
    },
    processedAt: {
      type:         DataTypes.DATE,
      allowNull:    false,
      defaultValue: DataTypes.NOW,
      columnName:   'processed_at',
    },
  },
  {
    sequelize,
    tableName:   'processed_recordings',
    underscored: true,
    indexes:     [
      // Note: mbid already has unique constraint at column level (line 44)
      { fields: ['source'] },
    ],
  },
);

export default ProcessedRecording;
