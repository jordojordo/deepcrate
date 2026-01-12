import type { PartialBy } from '@sequelize/utils';
import { DataTypes, Model } from '@sequelize/core';
import { sequelize } from '@server/config/db/sequelize';

/**
 * DiscoveredArtist attributes.
 * Tracks artists that have been discovered via catalog discovery
 * to prevent re-discovery.
 */
export interface DiscoveredArtistAttributes {
  id:           number;
  nameLower:    string;  // Lowercase artist name (unique)
  discoveredAt: Date;
  createdAt?:   Date;
  updatedAt?:   Date;
}

export type DiscoveredArtistCreationAttributes = PartialBy<DiscoveredArtistAttributes, 'id' | 'discoveredAt'>;

/**
 * Sequelize model for discovered artists.
 * Prevents catalog discovery from recommending the same artist multiple times.
 */
class DiscoveredArtist extends Model<DiscoveredArtistAttributes, DiscoveredArtistCreationAttributes> implements DiscoveredArtistAttributes {
  declare id:           number;
  declare nameLower:    string;
  declare discoveredAt: Date;
  declare createdAt?:   Date;
  declare updatedAt?:   Date;
}

DiscoveredArtist.init(
  {
    id: {
      type:          DataTypes.INTEGER,
      primaryKey:    true,
      autoIncrement: true,
    },
    nameLower: {
      type:       DataTypes.STRING(500),
      allowNull:  false,
      unique:     true,
      columnName: 'name_lower',
      comment:    'Lowercase artist name for case-insensitive uniqueness',
    },
    discoveredAt: {
      type:         DataTypes.DATE,
      allowNull:    false,
      defaultValue: DataTypes.NOW,
      columnName:   'discovered_at',
    },
  },
  {
    sequelize,
    tableName:   'discovered_artists',
    underscored: true,
    indexes:     [
      // Note: name_lower already has unique constraint at column level (line 42)
    ],
  },
);

export default DiscoveredArtist;
