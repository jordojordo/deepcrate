import { defineStore } from 'pinia';
import { ref, computed, watch } from 'vue';

export type ThemeMode = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'resonance_theme';

export const useThemeStore = defineStore('theme', () => {
  const mode = ref<ThemeMode>('system');
  const systemPrefersDark = ref(true);

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
    localStorage.setItem(STORAGE_KEY, newMode);
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
    // Get stored preference
    const stored = localStorage.getItem(STORAGE_KEY) as ThemeMode | null;

    if (stored && ['light', 'dark', 'system'].includes(stored)) {
      mode.value = stored;
    }

    // Set up system preference detection
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    systemPrefersDark.value = mediaQuery.matches;

    mediaQuery.addEventListener('change', (e) => {
      systemPrefersDark.value = e.matches;
      applyTheme();
    });

    // Apply initial theme
    applyTheme();
  }

  // Watch for mode changes
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
