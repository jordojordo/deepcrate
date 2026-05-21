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
  const scoring = computed(() => store.scoring);
  const webhooks = computed(() => store.webhooks);

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

  // Persist several sections from a single Save action, showing one toast.
  async function updateSections(
    updates: Array<{ section: SettingsSection; data: object }>
  ): Promise<boolean> {
    for (const { section, data } of updates) {
      const res = await store.updateSection(section, data);

      if (!res) {
        showError(store.error || 'Failed to save settings');

        return false;
      }
    }

    showSuccess('Settings saved');

    return true;
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
    scoring,
    webhooks,

    fetchSettings,
    updateSection,
    updateSections,
    validateSection,
    saveUIPreferences,
  };
}
