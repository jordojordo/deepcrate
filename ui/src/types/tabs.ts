import { DOWNLOADS_TABS, LIBRARY_TABS, SETTINGS_TABS } from '@/constants/settings';

export type SettingsTab = typeof SETTINGS_TABS[number];
export type DownloadsTab = typeof DOWNLOADS_TABS[number];
export type LibraryTab = typeof LIBRARY_TABS[number];
