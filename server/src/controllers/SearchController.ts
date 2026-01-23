import type { Request, Response } from 'express';
import type { AlbumSearchResult, ArtistSearchResult, RecordingSearchResult, MusicBrainzSearchResponse } from '@server/types/search';

import { BaseController } from '@server/controllers/BaseController';
import { MusicBrainzClient } from '@server/services/clients/MusicBrainzClient';
import { musicBrainzSearchQuerySchema } from '@server/types/search';
import { sendValidationError } from '@server/utils/errorHandler';

/**
 * Search controller for MusicBrainz search functionality
 */
class SearchController extends BaseController {
  private musicBrainzClient: MusicBrainzClient;

  constructor() {
    super();
    this.musicBrainzClient = new MusicBrainzClient();
  }

  /**
   * Search MusicBrainz for albums or artists
   * GET /api/v1/search/musicbrainz?q=query&type=album|artist&limit=20
   */
  searchMusicBrainz = async(req: Request, res: Response): Promise<Response> => {
    try {
      // Validate query parameters
      const parseResult = musicBrainzSearchQuerySchema.safeParse(req.query);

      if (!parseResult.success) {
        return sendValidationError(res, 'Invalid query parameters', { errors: parseResult.error.issues });
      }

      const { q, type, limit } = parseResult.data;

      let results: AlbumSearchResult[] | ArtistSearchResult[] | RecordingSearchResult[];
      let total: number;

      if (type === 'album') {
        const albumResults = await this.musicBrainzClient.searchAlbums(q, limit);

        results = albumResults.results;
        total = albumResults.total;
      } else if (type === 'track') {
        const recordingResults = await this.musicBrainzClient.searchRecordings(q, limit);

        results = recordingResults.results;
        total = recordingResults.total;
      } else {
        const artistResults = await this.musicBrainzClient.searchArtists(q, limit);

        results = artistResults.results;
        total = artistResults.total;
      }

      const response: MusicBrainzSearchResponse = {
        query: q,
        type,
        results,
        total,
      };

      return res.json(response);
    } catch(error) {
      return this.handleError(res, error as Error, 'Failed to search MusicBrainz');
    }
  };
}

export default new SearchController();
