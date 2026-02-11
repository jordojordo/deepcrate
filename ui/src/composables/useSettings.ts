import type { SettingsSection, UIPreferences } from '@/types';

import { computed } from 'vue';

import { useSettingsStore } from '@/stores/settings';
import { useToast } from '@/composables/useToast';

export function useSettings() {
  const store = useSettingsStore();
  const { showSuccess, showError } = useToast();

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
    try {
      await store.fetchSettings();
    } catch {
      showError('Failed to load settings');
    }
  }

  async function updateSection<T extends object>(
    section: SettingsSection,
    data: T
  ): Promise<boolean> {
    const success = await store.updateSection(section, data);

    if (success) {
      showSuccess('Settings saved');
    } else {
      showError(store.error || 'Failed to save settings');
    }

    return success;
  }

  async function validateSection<T extends object>(
    section: SettingsSection,
    data: T
  ) {
    return store.validateSection(section, data);
  }

  function saveUIPreferences(prefs: Partial<UIPreferences>) {
    store.saveUIPreferences(prefs);
    showSuccess('UI preferences saved');
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
