import type { ThemeMode } from '@/types';

import { defineStore, storeToRefs } from 'pinia';
import { ref, computed, watch } from 'vue';

import { useSettingsStore } from '@/stores/settings';

export const useThemeStore = defineStore('theme', () => {
  const settingsStore = useSettingsStore();
  const { uiPreferences } = storeToRefs(settingsStore);

  const systemPrefersDark = ref(true);

  const mode = computed({
    get: () => uiPreferences.value.theme,
    set: (newMode: ThemeMode) => {
      settingsStore.saveUIPreferences({ theme: newMode });
    },
  });

  const isDark = computed(() => {
    if (mode.value === 'system') {
      return systemPrefersDark.value;
    }

    return mode.value === 'dark';
  });

  function applyTheme() {
    if (isDark.value) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }

  function setMode(newMode: ThemeMode) {
    mode.value = newMode;
    applyTheme();
  }

  function cycleMode() {
    // Skip the system mode for now
    const modes: ThemeMode[] = ['light', 'dark'];
    const currentIndex = modes.indexOf(mode.value);
    const nextIndex = (currentIndex + 1) % modes.length;
    const nextMode = modes[nextIndex] ?? 'system';

    setMode(nextMode);
  }

  function initialize() {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    systemPrefersDark.value = mediaQuery.matches;

    mediaQuery.addEventListener('change', (e) => {
      systemPrefersDark.value = e.matches;
      applyTheme();
    });

    applyTheme();
  }

  // Watch for mode changes from settings or elsewhere
  watch(mode, () => {
    applyTheme();
  });

  return {
    mode,
    isDark,
    setMode,
    cycleMode,
    initialize,
  };
});
