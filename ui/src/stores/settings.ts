import type {
  SettingsResponse,
  SettingsSection,
  UIPreferences,
} from '@/types/settings';

import { defineStore } from 'pinia';
import { ref, computed } from 'vue';

import * as settingsApi from '@/services/settings';
import { DEFAULT_UI_PREFERENCES } from '@/types/settings';

const UI_PREFS_KEY = 'deepcrate_ui_prefs';

export const useSettingsStore = defineStore('settings', () => {
  const settings = ref<SettingsResponse | null>(null);
  const loading = ref(false);
  const saving = ref(false);
  const error = ref<string | null>(null);

  // UI preferences (localStorage only)
  const uiPreferences = ref<UIPreferences>(loadUIPreferences());

  const listenbrainz = computed(() => settings.value?.listenbrainz);
  const slskd = computed(() => settings.value?.slskd);
  const catalogDiscovery = computed(() => settings.value?.catalog_discovery);
  const libraryDuplicate = computed(() => settings.value?.library_duplicate);
  const libraryOrganize = computed(() => settings.value?.library_organize);
  const preview = computed(() => settings.value?.preview);
  const ui = computed(() => settings.value?.ui);

  /**
   * Load UI preferences from localStorage
   */
  function loadUIPreferences(): UIPreferences {
    try {
      const stored = localStorage.getItem(UI_PREFS_KEY);

      if (stored) {
        return { ...DEFAULT_UI_PREFERENCES, ...JSON.parse(stored) };
      }
    } catch(error) {
      console.warn('[settings] Failed to parse UI preferences from localStorage:', error);
    }

    return { ...DEFAULT_UI_PREFERENCES };
  }

  /**
   * Save UI preferences to localStorage
   */
  function saveUIPreferences(prefs: Partial<UIPreferences>) {
    uiPreferences.value = { ...uiPreferences.value, ...prefs };
    localStorage.setItem(UI_PREFS_KEY, JSON.stringify(uiPreferences.value));
  }

  /**
   * Fetch all settings from server
   */
  async function fetchSettings() {
    loading.value = true;
    error.value = null;

    try {
      settings.value = await settingsApi.getAll();
    } catch(e) {
      error.value = e instanceof Error ? e.message : 'Failed to fetch settings';
      throw e;
    } finally {
      loading.value = false;
    }
  }

  /**
   * Update a settings section
   */
  async function updateSection<T extends object>(
    section: SettingsSection,
    data: T
  ): Promise<boolean> {
    saving.value = true;
    error.value = null;

    try {
      await settingsApi.updateSection(section, data);

      // Refresh settings to get updated values
      await fetchSettings();

      return true;
    } catch(e) {
      const message = e instanceof Error ? e.message : 'Failed to save settings';

      error.value = message;

      return false;
    } finally {
      saving.value = false;
    }
  }

  /**
   * Validate settings without saving
   */
  async function validateSection<T extends object>(
    section: SettingsSection,
    data: T
  ): Promise<{ valid: boolean; errors?: Array<{ path: string; message: string }> }> {
    try {
      return await settingsApi.validate(section, data);
    } catch(e) {
      return {
        valid:  false,
        errors: [{
          path:    section,
          message: e instanceof Error ? e.message : 'Validation failed',
        }],
      };
    }
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
});
