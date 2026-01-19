<script setup lang="ts">
import { computed, ref } from 'vue';
import Select from 'primevue/select';

interface SourceData {
  label: string;
  value: number;
  color: string;
}

interface Props {
  sources: SourceData[];
  title?:  string;
}

const props = withDefaults(defineProps<Props>(), { title: 'Discovery Sources' });

const timePeriod = ref('30d');
const timePeriodOptions = [
  { label: 'Last 30 Days', value: '30d' },
  { label: 'All Time', value: 'all' },
];

// Calculate total for percentage
const total = computed(() => props.sources.reduce((sum, s) => sum + s.value, 0));

// Calculate stroke-dasharray and stroke-dashoffset for each segment
const segments = computed(() => {
  let offset = 0;

  return props.sources.map((source) => {
    const percentage = total.value > 0 ? (source.value / total.value) * 100 : 0;
    const segment = {
      ...source,
      percentage,
      dashArray:  `${ percentage } ${ 100 - percentage }`,
      dashOffset: -offset,
    };

    offset += percentage;

    return segment;
  });
});

// Get percentage for display
const getPercentage = (value: number): number => {
  return total.value > 0 ? Math.round((value / total.value) * 100) : 0;
};
</script>

<template>
  <div class="glass-panel p-6 flex flex-column h-full">
    <!-- Header -->
    <div class="flex align-items-center justify-content-between mb-6">
      <h3 class="text-xl font-bold text-white">{{ title }}</h3>
      <Select
        v-model="timePeriod"
        :options="timePeriodOptions"
        optionLabel="label"
        optionValue="value"
        class="discovery-chart__select"
      />
    </div>

    <!-- Empty State -->
    <div v-if="sources.length === 0" class="flex flex-column align-items-center justify-content-center flex-1 py-8">
      <i class="pi pi-chart-pie text-4xl text-white/20 mb-3"></i>
      <p class="text-white/40 text-sm mb-1">No discovery data yet</p>
      <p class="text-white/30 text-xs">Coming soon</p>
    </div>

    <!-- Chart and Legend -->
    <div v-else class="flex flex-column md:flex-row gap-8 align-items-center justify-content-between flex-1">
      <!-- Donut Chart -->
      <div class="discovery-chart__donut relative flex-shrink-0">
        <svg class="w-full h-full" viewBox="0 0 36 36" style="transform: rotate(-90deg);">
          <circle
            v-for="(segment, index) in segments"
            :key="index"
            class="discovery-chart__segment"
            :style="{ stroke: segment.color }"
            cx="18"
            cy="18"
            r="15.9155"
            fill="none"
            stroke-width="3.8"
            :stroke-dasharray="segment.dashArray"
            :stroke-dashoffset="segment.dashOffset"
          />
        </svg>
        <!-- Center text -->
        <div class="discovery-chart__center">
          <span class="text-3xl font-bold text-white">{{ sources.length }}</span>
          <span class="text-xs text-white/50 uppercase tracking-wide">Sources</span>
        </div>
      </div>

      <!-- Legend -->
      <div class="flex flex-column w-full gap-4">
        <div
          v-for="source in sources"
          :key="source.label"
          class="discovery-chart__legend-item"
        >
          <div class="flex align-items-center gap-2">
            <div
              class="size-2 rounded-full"
              :style="{ backgroundColor: source.color }"
            ></div>
            <span class="text-sm text-white/80">{{ source.label }}</span>
          </div>
          <span class="text-sm font-bold text-white">{{ getPercentage(source.value) }}%</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.discovery-chart__donut {
  width: 12rem;
  height: 12rem;
}

@media (min-width: 768px) {
  .discovery-chart__donut {
    width: 14rem;
    height: 14rem;
  }
}

.discovery-chart__segment {
  transition: stroke-dasharray 0.3s ease;
}

.discovery-chart__center {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.discovery-chart__legend-item {
  padding: 0.75rem;
  border-radius: 0.375rem;
  background: var(--r-overlay-light);
  border: 1px solid var(--r-border-subtle);
  display: flex;
  align-items: center;
  justify-content: space-between;
}

/* Select dropdown styling */
:deep(.discovery-chart__select) {
  background: var(--r-overlay-medium);
  border: 1px solid var(--r-border-default);
  border-radius: 0.375rem;
}

:deep(.discovery-chart__select .p-select-label) {
  font-size: 0.75rem;
  color: var(--r-text-secondary);
  padding: 0.25rem 0.5rem;
}

:deep(.discovery-chart__select:focus-within) {
  border-color: var(--primary-color);
}
</style>
