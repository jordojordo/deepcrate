<script setup lang="ts">
import type { DownloadProgress as DownloadProgressType } from '@/types';

import { computed } from 'vue';

import ProgressBar from 'primevue/progressbar';

interface Props {
  progress: DownloadProgressType;
}

const props = defineProps<Props>();

const percentComplete = computed(() => {
  if (!props.progress.bytesTotal) return 0;

  return Math.round((props.progress.bytesTransferred / props.progress.bytesTotal) * 100);
});

const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${ parseFloat((bytes / Math.pow(k, i)).toFixed(2)) } ${ sizes[i] }`;
};

const formatSpeed = (bytesPerSecond: number | null): string => {
  if (!bytesPerSecond) return 'N/A';

  return `${ formatBytes(bytesPerSecond) }/s`;
};

const formatTime = (seconds: number | null): string => {
  if (!seconds) return 'N/A';
  if (seconds < 60) return `${ Math.round(seconds) }s`;
  if (seconds < 3600) return `${ Math.round(seconds / 60) }m`;

  return `${ Math.round(seconds / 3600) }h`;
};
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
        ETA: {{ formatTime(progress.estimatedTimeRemaining) }}
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
