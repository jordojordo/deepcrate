import type { UIPreferences } from '@/types';

export const DEFAULT_UI_PREFERENCES: UIPreferences = {
  theme:            'dark',
  queueViewMode:    'grid',
  wishlistViewMode: 'grid',
  sidebarCollapsed: false,
  itemsPerPage:     25,
};

export const UI_PREFS_KEY = 'deepcrate_ui_prefs';

export const SETTINGS_TABS = ['listenbrainz', 'catalog', 'slskd', 'preview', 'auth', 'ui'] as const;
export const DOWNLOADS_TABS = ['active', 'completed', 'failed'] as const;
export const LIBRARY_TABS = ['unorganized', 'configuration'] as const;
