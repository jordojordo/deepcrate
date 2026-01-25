<script setup lang="ts">
import { computed } from 'vue';
import { useThemeStore, type ThemeMode } from '@/stores/theme';

import Button from 'primevue/button';

defineProps<{
  collapsed?: boolean;
}>();

const themeStore = useThemeStore();

const icon = computed(() => {
  const icons: Record<ThemeMode, string> = {
    light:  'pi pi-sun',
    dark:   'pi pi-moon',
    system: 'pi pi-desktop',
  };

  return icons[themeStore.mode];
});

const label = computed(() => {
  const labels: Record<ThemeMode, string> = {
    light:  'Light',
    dark:   'Dark',
    system: 'System',
  };

  return labels[themeStore.mode];
});

const tooltip = computed(() => {
  return `Theme: ${ label.value } (click to change)`;
});
</script>

<template>
  <Button
    :icon="icon"
    :label="collapsed ? '' : label"
    severity="secondary"
    text
    class="theme-toggle"
    :aria-label="tooltip"
    v-tooltip.top="tooltip"
    @click="themeStore.cycleMode()"
  />
</template>

<style scoped>
.theme-toggle {
  justify-content: flex-start;
  width: auto;
  padding: 0.5rem 0.75rem;
  border-radius: 0.5rem;
  color: var(--surface-300);
  transition: background-color 0.2s ease, color 0.2s ease;
}

.theme-toggle:hover {
  background-color: var(--r-hover-bg);
  color: var(--r-text-primary);
}

:deep(.p-button-label) {
  font-weight: 500;
}
</style>
