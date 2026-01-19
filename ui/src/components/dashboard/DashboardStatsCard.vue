<script setup lang="ts">
import type { ActiveDownload } from '@/types';

import { computed } from 'vue';
import { RouterLink } from 'vue-router';

import Button from 'primevue/button';

import { formatSpeed } from '@/utils/formatters';

interface TrendData {
  value:    string;
  positive: boolean;
}

interface Props {
  title:        string;
  value:        string | number;
  unit?:        string;
  subtitle?:    string;
  color?:       'primary' | 'green' | 'orange' | 'purple' | 'teal';
  icon?:        string;
  progress?:    { value: number; label?: string };
  downloads?:   ActiveDownload[];
  trend?:       TrendData;
  trendBars?:   number[];
  actionLabel?: string;
  actionRoute?: string;
  showPulse?:   boolean;
  speed?:       number;
}

const props = withDefaults(defineProps<Props>(), {
  color: 'primary',
  icon:  'pi-chart-bar',
});

const colorClasses = computed(() => {
  const colors = {
    primary: {
      text:  'text-primary',
      bg:    'bg-primary-100 dark:bg-primary-900/30',
      pulse: 'bg-primary',
      bar:   'bg-primary',
    },
    green: {
      text:  'text-green-500',
      bg:    'bg-green-100 dark:bg-green-900/30',
      pulse: 'bg-green-500',
      bar:   'bg-green-500',
    },
    orange: {
      text:  'text-orange-500',
      bg:    'bg-orange-100 dark:bg-orange-900/30',
      pulse: 'bg-orange-500',
      bar:   'bg-orange-500',
    },
    purple: {
      text:  'text-purple-500',
      bg:    'bg-purple-100 dark:bg-purple-900/30',
      pulse: 'bg-purple-500',
      bar:   'bg-purple-500',
    },
    teal: {
      text:  'text-teal-400',
      bg:    'bg-teal-100 dark:bg-teal-900/30',
      pulse: 'bg-teal-500',
      bar:   'bg-teal-500',
    },
  };

  return colors[props.color];
});

const trendBadgeClass = computed(() => {
  if (props.trend?.positive) {
    return 'bg-green-500/20 text-green-400 border-green-500/30';
  }

  return  'bg-red-500/20 text-red-400 border-red-500/30';
});

// function trendBarClass(index: number) {
//   if (props.trendBars && index === props.trendBars.length - 1) {
//     return `${ colorClasses.value.bar } shadow-[0_0_10px_rgba(43,43,238,0.5)]`;
//   }

//   return 'bg-white/10 hover:bg-primary/50';
// }

function activeDownloadProgress(activeDownload: ActiveDownload) {
  if (!activeDownload.progress) {
    return 0;
  }

  return Math.round((activeDownload.progress.bytesTransferred! / activeDownload.progress.bytesTotal!) * 100);
}
</script>

<template>
  <div class="dashboard-stats-card glass-panel glass-panel--hover p-6 relative overflow-hidden group">
    <div class="relative z-10">
      <!-- Header row -->
      <div class="flex align-items-center justify-content-between mb-4">
        <p class="text-white/60 text-sm font-medium">{{ title }}</p>
        <div class="flex align-items-center gap-2">
          <span v-if="speed" class="text-primary text-xs font-mono">{{ formatSpeed(speed) }}</span>
          <span
            v-if="showPulse"
            class="size-2 rounded-full animate-pulse"
            :class="colorClasses.pulse"
          ></span>
        </div>
      </div>

      <!-- Value display -->
      <div class="flex align-items-end gap-2 mb-1">
        <p class="text-4xl font-bold text-white leading-none">{{ value }}</p>
        <span v-if="unit" class="text-2xl text-white/50 mb-0.5">{{ unit }}</span>
      </div>

      <!-- Subtitle -->
      <p v-if="subtitle" class="text-white/40 text-sm mb-4">{{ subtitle }}</p>

      <!-- Trend badge -->
      <div v-if="trend" class="mb-4">
        <span
          class="px-2 py-1 rounded text-xs font-bold border"
          :class="trendBadgeClass"
        >
          {{ trend.value }}
        </span>
      </div>

      <!-- Mini bar chart for trends -->
      <!-- TODO: Implement mini bar (or line) chart for trends -->
      <!--       But what does trend mean? How is that useful? -->
      <!-- <div v-if="trendBars && trendBars.length > 0" class="flex align-items-end gap-1 h-12 mt-auto mb-4">
        <div
          v-for="(bar, index) in trendBars"
          :key="index"
          class="flex-1 rounded-sm transition-colors"
          :class="trendBarClass(index)"
          :style="{ height: `${bar}%` }"
        ></div>
      </div> -->

      <!-- Download progress items -->
      <div v-if="downloads && downloads.length > 0" class="space-y-3 mb-4">
        <div v-for="download in downloads" :key="download.id">
          <div class="flex justify-content-between text-xs text-white/70 mb-1">
            <span class="truncate max-w-[180px]">{{ download.artist }} - {{ download.album }}</span>
            <span>{{ activeDownloadProgress(download) }}%</span>
          </div>
          <div class="h-1\.5 w-full bg-white/10 rounded-full overflow-hidden">
            <div
              class="h-full rounded-full transition-all"
              :class="colorClasses.bar"
              :style="{ width: `${ activeDownloadProgress(download) }%` }"
            ></div>
          </div>
        </div>
      </div>

      <!-- Progress bar -->
      <div v-if="progress" class="relative pt-2">
        <div class="flex align-items-center justify-content-between text-xs mb-2">
          <span class="text-white/70">{{ progress.label || `${progress.value}%` }}</span>
          <span v-if="progress.label" class="text-white/40">{{ 100 - progress.value }}% Free</span>
        </div>
        <div class="h-2 w-full bg-white/10 rounded-full overflow-hidden">
          <div
            class="h-full rounded-full bg-gradient-to-r from-primary to-purple-500"
            :style="{ width: `${progress.value}%` }"
          ></div>
        </div>
      </div>

      <!-- Action button -->
      <RouterLink v-if="actionRoute && actionLabel" :to="actionRoute" class="no-underline">
        <Button
          :label="actionLabel"
          class="w-full mt-4"
          severity="secondary"
          outlined
        />
      </RouterLink>
    </div>
  </div>
</template>

<style scoped>
.dashboard-stats-card {
  transition: all 0.3s ease;
}

.dashboard-stats-card__watermark {
  position: absolute;
  right: 0;
  top: 0;
  padding: 1rem;
  opacity: 0.1;
  transition: opacity 0.3s ease;
}

.dashboard-stats-card__watermark i {
  font-size: 5rem;
  color: var(--r-text-primary);
}

.dashboard-stats-card:hover .dashboard-stats-card__watermark {
  opacity: 0.2;
}

/* Override button styles for the action button */
:deep(.p-button.p-button-secondary.p-button-outlined) {
  background: rgba(43, 43, 238, 0.2);
  border-color: rgba(43, 43, 238, 0.3);
  color: var(--primary-500);
}

:deep(.p-button.p-button-secondary.p-button-outlined:hover) {
  background: var(--primary-500);
  border-color: var(--primary-500);
  color: var(--r-text-primary);
}

/* Space-y utility */
.space-y-3 > * + * {
  margin-top: 0.75rem;
}
</style>
