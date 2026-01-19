<script setup lang="ts">
import type { OrganizeProgress } from '@/types';

import { computed } from 'vue';

import ProgressBar from 'primevue/progressbar';

const props = defineProps<{
  progress: OrganizeProgress | null;
}>();

const percent = computed(() => {
  if (typeof props.progress?.total !== 'number' || typeof props.progress.current !== 'number') {
    return null;
  }

  if (props.progress.total <= 0) {
    return null;
  }

  return Math.min(100, Math.round((props.progress.current / props.progress.total) * 100));
});
</script>

<template>
  <div v-if="progress" class="organize-progress">
    <div class="organize-progress__header">
      <span class="organize-progress__message">{{ progress.message }}</span>
      <span v-if="progress.current !== undefined && progress.total !== undefined" class="organize-progress__counts">
        {{ progress.current }}/{{ progress.total }}
      </span>
    </div>

    <ProgressBar
      v-if="percent !== null"
      :value="percent"
      class="organize-progress__bar"
    />
    <ProgressBar
      v-else
      mode="indeterminate"
      class="organize-progress__bar"
    />
  </div>
</template>

<style scoped>
.organize-progress {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 1rem;
  border-radius: 0.75rem;
  border: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.08));
  background: var(--surface-glass, rgba(21, 21, 37, 0.7));
}

.organize-progress__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.organize-progress__message {
  color: var(--r-text-primary);
  font-size: 0.875rem;
}

.organize-progress__counts {
  color: var(--surface-300);
  font-size: 0.75rem;
  font-variant-numeric: tabular-nums;
}

.organize-progress__bar {
  height: 8px;
  border-radius: 4px;
}
</style>
