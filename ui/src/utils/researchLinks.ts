// TODO: Make research link services configurable via config.yaml
// using URL templates (e.g., "https://musicbrainz.org/release-group/{mbid}")

export interface ResearchLinkDef {
  name: string;
  url:  string;
}

interface ResearchLinkParams {
  artist: string;
  album?: string;
  track?: string;
  mbid:   string;
}

export function buildResearchLinks(params: ResearchLinkParams): ResearchLinkDef[] {
  const artist = encodeURIComponent(params.artist);
  const album = params.album ? encodeURIComponent(params.album) : '';
  const track = params.track ? encodeURIComponent(params.track) : '';
  const searchTerm = [params.artist, params.album || params.track]
    .filter(Boolean)
    .join(' ');
  const encodedSearch = encodeURIComponent(searchTerm);

  return [
    {
      name: 'MusicBrainz',
      url:  `https://musicbrainz.org/release-group/${ params.mbid }`,
    },
    {
      name: 'Last.fm',
      url:  track ? `https://www.last.fm/music/${ artist }/_/${ track }` : `https://www.last.fm/music/${ artist }/${ album }`,
    },
    {
      name: 'Discogs',
      url:  `https://www.discogs.com/search/?q=${ encodedSearch }&type=release`,
    },
    {
      name: 'RYM',
      url:  `https://rateyourmusic.com/search?searchterm=${ encodedSearch }`,
    },
    {
      name: 'Bandcamp',
      url:  `https://bandcamp.com/search?q=${ artist }`,
    },
  ];
}

export function getMusicBrainzUrl(mbid: string): string {
  return `https://musicbrainz.org/release-group/${ mbid }`;
}
