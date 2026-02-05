import type { PartialBy } from '@sequelize/utils';
import { DataTypes, Model } from '@sequelize/core';
import { sequelize } from '@server/config/db/sequelize';

/**
 * LibraryAlbum attributes.
 * Caches albums from the user's music library (Subsonic-compatible server) for duplicate detection.
 */
export interface LibraryAlbumAttributes {
  id:           number;
  navidromeId:  string;     // Subsonic album ID (column name preserved for DB compatibility)
  name:         string;     // Original album name
  nameLower:    string;     // Lowercase for lookups
  artist:       string;     // Original artist name
  artistLower:  string;     // Lowercase for lookups
  year?:        number;
  lastSyncedAt: Date;
  createdAt?:   Date;
  updatedAt?:   Date;
}

export type LibraryAlbumCreationAttributes = PartialBy<LibraryAlbumAttributes, 'id' | 'lastSyncedAt'>;

/**
 * Sequelize model for library albums.
 * Stores albums from the user's library for duplicate detection.
 */
class LibraryAlbum extends Model<LibraryAlbumAttributes, LibraryAlbumCreationAttributes> implements LibraryAlbumAttributes {
  declare id:           number;
  declare navidromeId:  string;
  declare name:         string;
  declare nameLower:    string;
  declare artist:       string;
  declare artistLower:  string;
  declare year?:        number;
  declare lastSyncedAt: Date;
  declare createdAt?:   Date;
  declare updatedAt?:   Date;
}

LibraryAlbum.init(
  {
    id: {
      type:          DataTypes.INTEGER,
      primaryKey:    true,
      autoIncrement: true,
    },
    navidromeId: {
      type:       DataTypes.STRING(255),
      allowNull:  false,
      unique:     true,
      columnName: 'navidrome_id', // Column name preserved for DB compatibility
      comment:    'Subsonic server album ID',
    },
    name: {
      type:      DataTypes.STRING(500),
      allowNull: false,
    },
    nameLower: {
      type:       DataTypes.STRING(500),
      allowNull:  false,
      columnName: 'name_lower',
      comment:    'Lowercase name for case-insensitive lookups',
    },
    artist: {
      type:      DataTypes.STRING(500),
      allowNull: false,
    },
    artistLower: {
      type:       DataTypes.STRING(500),
      allowNull:  false,
      columnName: 'artist_lower',
      comment:    'Lowercase artist name for case-insensitive lookups',
    },
    year: {
      type:      DataTypes.INTEGER,
      allowNull: true,
    },
    lastSyncedAt: {
      type:         DataTypes.DATE,
      allowNull:    false,
      defaultValue: DataTypes.NOW,
      columnName:   'last_synced_at',
    },
  },
  {
    sequelize,
    tableName:   'library_albums',
    underscored: true,
    indexes:     [
      { fields: ['navidrome_id'] },
      { fields: ['name_lower', 'artist_lower'] },
      { fields: ['artist_lower'] },
    ],
  },
);

export default LibraryAlbum;
