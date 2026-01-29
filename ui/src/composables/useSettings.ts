import type { SettingsSection, UIPreferences } from '@/types/settings';

import { computed } from 'vue';
import { useSettingsStore } from '@/stores/settings';

export function useSettings() {
  const store = useSettingsStore();

  const settings = computed(() => store.settings);
  const loading = computed(() => store.loading);
  const saving = computed(() => store.saving);
  const error = computed(() => store.error);
  const uiPreferences = computed(() => store.uiPreferences);

  const listenbrainz = computed(() => store.listenbrainz);
  const slskd = computed(() => store.slskd);
  const catalogDiscovery = computed(() => store.catalogDiscovery);
  const libraryDuplicate = computed(() => store.libraryDuplicate);
  const libraryOrganize = computed(() => store.libraryOrganize);
  const preview = computed(() => store.preview);
  const ui = computed(() => store.ui);

  async function fetchSettings() {
    return store.fetchSettings();
  }

  async function updateSection<T extends object>(
    section: SettingsSection,
    data: T
  ): Promise<boolean> {
    return store.updateSection(section, data);
  }

  async function validateSection<T extends object>(
    section: SettingsSection,
    data: T
  ) {
    return store.validateSection(section, data);
  }

  function saveUIPreferences(prefs: Partial<UIPreferences>) {
    store.saveUIPreferences(prefs);
  }

  return {
    settings,
    loading,
    saving,
    error,
    uiPreferences,

    listenbrainz,
    slskd,
    catalogDiscovery,
    libraryDuplicate,
    libraryOrganize,
    preview,
    ui,

    fetchSettings,
    updateSection,
    validateSection,
    saveUIPreferences,
  };
}
