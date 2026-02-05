export type LibraryOrganizationMode = 'flat' | 'artist_album';

export interface LibraryOrganizeConfig {
  enabled:           boolean;
  downloads_path:    string | null;
  library_path:      string | null;
  organization:      LibraryOrganizationMode;
  interval:          number;
  auto_organize:     boolean;
  delete_after_move: boolean;
  subsonic_rescan:   boolean;
  beets:             { enabled: boolean; command: string };
}

export interface LibraryOrganizeStatus {
  enabled:     boolean;
  configured:  boolean;
  completed:   number;
  unorganized: number;
  organized:   number;
}

export interface UnorganizedTask {
  id:          string;
  artist:      string;
  album:       string;
  type:        string;
  completedAt: string;
}

export interface PaginatedUnorganizedTasks {
  items: UnorganizedTask[];
  total: number;
}

export interface OrganizeProgress {
  message:  string;
  current?: number;
  total?:   number;
}

