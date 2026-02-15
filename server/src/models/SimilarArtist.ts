import type { PartialBy } from '@sequelize/utils';

import { DataTypes, Model } from '@sequelize/core';
import { sequelize } from '@server/config/db/sequelize';

export interface SimilarArtistAttributes {
  id:              number;
  catalogArtistId: number;
  name:            string;
  nameLower:       string;
  mbid?:           string | null;
  score:           number; // 0-1 match score
  provider:        string; // 'listenbrainz' | 'lastfm'
  fetchedAt:       Date;
  createdAt?:      Date;
  updatedAt?:      Date;
}

export type SimilarArtistCreationAttributes = PartialBy<SimilarArtistAttributes, 'id'>;

class SimilarArtist extends Model<SimilarArtistAttributes, SimilarArtistCreationAttributes> implements SimilarArtistAttributes {
  declare id:              number;
  declare catalogArtistId: number;
  declare name:            string;
  declare nameLower:       string;
  declare mbid:            string | null;
  declare score:           number;
  declare provider:        string;
  declare fetchedAt:       Date;
  declare createdAt?:      Date;
  declare updatedAt?:      Date;
}

SimilarArtist.init(
  {
    id: {
      type:          DataTypes.INTEGER,
      primaryKey:    true,
      autoIncrement: true,
    },
    catalogArtistId: {
      type:       DataTypes.INTEGER,
      allowNull:  false,
      columnName: 'catalog_artist_id',
    },
    name: {
      type:      DataTypes.STRING(500),
      allowNull: false,
    },
    nameLower: {
      type:       DataTypes.STRING(500),
      allowNull:  false,
      columnName: 'name_lower',
    },
    mbid: {
      type:      DataTypes.STRING(255),
      allowNull: true,
    },
    score: {
      type:      DataTypes.FLOAT,
      allowNull: false,
    },
    provider: {
      type:      DataTypes.STRING(50),
      allowNull: false,
    },
    fetchedAt: {
      type:       DataTypes.DATE,
      allowNull:  false,
      columnName: 'fetched_at',
    },
  },
  {
    sequelize,
    tableName:   'similar_artists',
    underscored: true,
    indexes:     [
      {
        unique: true,
        fields: ['catalog_artist_id', 'name_lower', 'provider'],
        name:   'similar_artists_catalog_name_provider_unique',
      },
      { fields: ['catalog_artist_id'] },
      { fields: ['name_lower'] },
    ],
  },
);

export default SimilarArtist;
