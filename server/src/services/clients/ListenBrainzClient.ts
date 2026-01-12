import axios from 'axios';
import logger from '@server/config/logger';

export interface ListenBrainzRecommendation {
  recording_mbid: string;
  score?:         number;
}

/**
 * ListenBrainzClient provides access to ListenBrainz recommendation API.
 * https://api.listenbrainz.org/
 */
export class ListenBrainzClient {
  private baseUrl = 'https://api.listenbrainz.org/1';

  /**
   * Fetch recording recommendations for a user
   */
  async fetchRecommendations(
    username: string,
    token: string,
    count: number = 100
  ): Promise<ListenBrainzRecommendation[]> {
    const url = `${ this.baseUrl }/cf/recommendation/user/${ username }/recording`;

    try {
      const response = await axios.get(url, {
        headers: { Authorization: `Token ${ token }` },
        params:  { count },
        timeout: 30000,
      });

      if (response.status === 204) {
        logger.warn('No recommendations yet - need more listening history');

        return [];
      }

      const mbids = response.data?.payload?.mbids || [];

      return mbids;
    } catch(error) {
      if (axios.isAxiosError(error)) {
        logger.error(`Failed to fetch ListenBrainz recommendations: ${ error.message }`);
      } else {
        logger.error(`Failed to fetch ListenBrainz recommendations: ${ String(error) }`);
      }

      return [];
    }
  }
}

export default ListenBrainzClient;
