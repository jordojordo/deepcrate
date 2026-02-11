<script setup lang="ts">
import type { DownloadProgress } from '@/types';

import { computed } from 'vue';
import { formatBytes, formatSpeed, formatDuration } from '@/utils/formatters';

import ProgressBar from 'primevue/progressbar';

interface Props {
  progress: DownloadProgress;
}

const props = defineProps<Props>();

const percentComplete = computed(() => {
  if (!props.progress.bytesTotal) return 0;

  return Math.round((props.progress.bytesTransferred / props.progress.bytesTotal) * 100);
});
</script>

<template>
  <div class="download-progress">
    <ProgressBar :value="percentComplete" class="download-progress__bar" />

    <div class="download-progress__details">
      <span class="download-progress__files">
        {{ progress.filesCompleted }} / {{ progress.filesTotal }} files
      </span>
      <span class="download-progress__bytes">
        {{ formatBytes(progress.bytesTransferred) }} / {{ formatBytes(progress.bytesTotal) }}
      </span>
      <span class="download-progress__speed" v-if="progress.averageSpeed">
        {{ formatSpeed(progress.averageSpeed) }}
      </span>
      <span class="download-progress__eta" v-if="progress.estimatedTimeRemaining">
        ETA: {{ formatDuration(progress.estimatedTimeRemaining) }}
      </span>
    </div>
  </div>
</template>

<style scoped>
.download-progress {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.download-progress__bar {
  height: 8px;
  border-radius: 4px;
}

.download-progress__details {
  display: flex;
  gap: 1rem;
  font-size: 0.75rem;
  color: var(--surface-300);
}
</style>
