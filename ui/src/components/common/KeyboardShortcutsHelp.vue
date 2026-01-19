<script setup lang="ts">
import type { ShortcutDefinition } from '@/composables/useKeyboardShortcuts';

import Dialog from 'primevue/dialog';

interface Props {
  visible:   boolean;
  shortcuts: ShortcutDefinition[];
}

defineProps<Props>();

const emit = defineEmits<{
  'update:visible': [value: boolean];
}>();
</script>

<template>
  <Dialog
    :visible="visible"
    modal
    header="Keyboard Shortcuts"
    :style="{ width: '400px' }"
    @update:visible="emit('update:visible', $event)"
  >
    <div class="shortcuts-list">
      <div
        v-for="shortcut in shortcuts"
        :key="shortcut.key"
        class="shortcuts-list__item"
      >
        <kbd class="shortcuts-list__key">{{ shortcut.key }}</kbd>
        <span class="shortcuts-list__description">{{ shortcut.description }}</span>
      </div>
    </div>
  </Dialog>
</template>

<style scoped>
.shortcuts-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.shortcuts-list__item {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.shortcuts-list__key {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 2rem;
  padding: 0.25rem 0.5rem;
  border-radius: 0.375rem;
  background: var(--r-hover-bg);
  border: 1px solid var(--r-border-default);
  color: var(--r-text-secondary);
  font-family: inherit;
  font-size: 0.875rem;
  font-weight: 600;
}

.shortcuts-list__description {
  color: var(--r-text-muted);
  font-size: 0.875rem;
}
</style>
