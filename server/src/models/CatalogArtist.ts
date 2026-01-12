import type { PartialBy } from '@sequelize/utils';
import { DataTypes, Model } from '@sequelize/core';
import { sequelize } from '@server/config/db/sequelize';

/**
 * CatalogArtist attributes.
 * Caches artists from the user's music library (Navidrome).
 */
export interface CatalogArtistAttributes {
  id:           number;
  navidromeId:  string;  // Navidrome/Subsonic artist ID
  name:         string;
  nameLower:    string;  // Lowercase name for case-insensitive lookups
  lastSyncedAt: Date;
  createdAt?:   Date;
  updatedAt?:   Date;
}

export type CatalogArtistCreationAttributes = PartialBy<CatalogArtistAttributes, 'id' | 'lastSyncedAt'>;

/**
 * Sequelize model for catalog artists.
 * Stores artists from the user's library for catalog-based discovery.
 */
class CatalogArtist extends Model<CatalogArtistAttributes, CatalogArtistCreationAttributes> implements CatalogArtistAttributes {
  declare id:           number;
  declare navidromeId:  string;
  declare name:         string;
  declare nameLower:    string;
  declare lastSyncedAt: Date;
  declare createdAt?:   Date;
  declare updatedAt?:   Date;
}

CatalogArtist.init(
  {
    id: {
      type:          DataTypes.INTEGER,
      primaryKey:    true,
      autoIncrement: true,
    },
    navidromeId: {
      type:       DataTypes.STRING(255),
      allowNull:  false,
      columnName: 'navidrome_id',
      comment:    'Navidrome/Subsonic artist ID',
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
    lastSyncedAt: {
      type:         DataTypes.DATE,
      allowNull:    false,
      defaultValue: DataTypes.NOW,
      columnName:   'last_synced_at',
    },
  },
  {
    sequelize,
    tableName:   'catalog_artists',
    underscored: true,
    indexes:     [
      { fields: ['name_lower'] },
      { fields: ['navidrome_id'] },
    ],
  },
);

export default CatalogArtist;
