export const ROUTE_PATHS = {
  DASHBOARD: '/dashboard',
  QUEUE:     '/queue',
  WISHLIST:  '/wishlist',
  DOWNLOADS: '/downloads',
  LIBRARY:   '/library',
  SETTINGS:  '/settings',
  LOGIN:     '/login',
} as const;

export const ROUTE_NAMES = {
  DASHBOARD: 'dashboard',
  QUEUE:     'queue',
  WISHLIST:  'wishlist',
  DOWNLOADS: 'downloads',
  LIBRARY:   'library',
  SETTINGS:  'settings',
  LOGIN:     'login',
} as const;

export const EXTERNAL_URLS = {
  DOCS_SITE: 'https://jordojordo.github.io/deepcrate/',
  API_DOCS:  '/api/v1/docs',
  GITHUB:    'https://github.com/jordojordo/deepcrate',
} as const;
