/**
 * CoverArtArchiveClient provides access to album cover art.
 * https://coverartarchive.org/
 */
export class CoverArtArchiveClient {
  /**
   * Get cover art URL for a release group
   */
  getCoverUrl(releaseGroupMbid: string, size: '250' | '500' | '1200' = '250'): string | null {
    if (!releaseGroupMbid) {
      return null;
    }

    return `https://coverartarchive.org/release-group/${ releaseGroupMbid }/front-${ size }`;
  }
}

export default CoverArtArchiveClient;
