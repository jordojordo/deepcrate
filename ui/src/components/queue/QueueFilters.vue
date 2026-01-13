<script setup lang="ts">
import Select from 'primevue/select';
import Button from 'primevue/button';
import type { QueueFilters } from '@/types';
import { SORT_OPTIONS } from '@/constants/queue';

export type ViewMode = 'grid' | 'list';

const sortOptions = [...SORT_OPTIONS];

const props = defineProps<{
  modelValue: QueueFilters;
  viewMode?:  ViewMode;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: QueueFilters];
  'update:viewMode':   [value: ViewMode];
}>();

const sourceOptions = [
  { label: 'All Sources', value: 'all' },
  { label: 'ListenBrainz', value: 'listenbrainz' },
  { label: 'Catalog', value: 'catalog' },
];

function updateFilter<K extends keyof QueueFilters>(key: K, value: QueueFilters[K]) {
  emit('update:modelValue', { ...props.modelValue, [key]: value });
}

function toggleOrder() {
  updateFilter('order', props.modelValue.order === 'asc' ? 'desc' : 'asc');
}

function setViewMode(mode: ViewMode) {
  emit('update:viewMode', mode);
}
</script>

<template>
  <div class="queue-filters">
    <div class="queue-filters__row">
      <!-- Left: Filter dropdowns -->
      <div class="queue-filters__left">
        <Button
          class="queue-filters__btn"
          outlined
        >
          <span>Source: {{ sourceOptions.find(o => o.value === modelValue.source)?.label }}</span>
          <i class="pi pi-chevron-down ml-2"></i>
          <Select
            :model-value="modelValue.source"
            @update:model-value="updateFilter('source', $event)"
            :options="sourceOptions"
            option-label="label"
            option-value="value"
            class="queue-filters__hidden-select"
          />
        </Button>

        <Button
          class="queue-filters__btn"
          outlined
        >
          <span>Sort: {{ sortOptions.find(o => o.value === modelValue.sort)?.label }}</span>
          <i class="pi pi-chevron-down ml-2"></i>
          <Select
            :model-value="modelValue.sort"
            @update:model-value="updateFilter('sort', $event)"
            :options="sortOptions"
            option-label="label"
            option-value="value"
            class="queue-filters__hidden-select"
          />
        </Button>
      </div>

      <!-- Right: Sort direction and view toggle -->
      <div class="queue-filters__right">
        <span class="queue-filters__label">Sort by</span>
        <Button
          class="queue-filters__sort-btn"
          text
          @click="toggleOrder"
        >
          {{ sortOptions.find(o => o.value === modelValue.sort)?.label }}
          <i :class="['pi ml-2', modelValue.order === 'desc' ? 'pi-arrow-down' : 'pi-arrow-up']"></i>
        </Button>

        <div class="queue-filters__divider"></div>

        <!-- View toggle buttons -->
        <Button
          icon="pi pi-th-large"
          :class="['queue-filters__view-btn', { 'queue-filters__view-btn--active': viewMode === 'grid' }]"
          :text="viewMode !== 'grid'"
          aria-label="Grid View"
          @click="setViewMode('grid')"
        />
        <Button
          icon="pi pi-list"
          :class="['queue-filters__view-btn', { 'queue-filters__view-btn--active': viewMode === 'list' }]"
          :text="viewMode !== 'list'"
          aria-label="List View"
          @click="setViewMode('list')"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.queue-filters {
  padding: 0.75rem 0;
}

.queue-filters__row {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

@media (min-width: 640px) {
  .queue-filters__row {
    flex-direction: row;
    justify-content: space-between;
    align-items: center;
  }
}

.queue-filters__left {
  display: flex;
  gap: 0.75rem;
  overflow-x: auto;
  padding-bottom: 0.25rem;
}

.queue-filters__right {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-left: auto;
}

.queue-filters__label {
  font-size: 0.75rem;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--surface-300);
  margin-right: 0.5rem;
}

.queue-filters__divider {
  width: 1px;
  height: 1rem;
  background: var(--surface-600);
  margin: 0 0.5rem;
}

/* Filter button styling */
:deep(.queue-filters__btn) {
  position: relative;
  height: 2.25rem;
  padding: 0 1rem;
  font-size: 0.875rem;
  font-weight: 500;
  white-space: nowrap;
  background: var(--surface-700);
  border-color: var(--surface-600);
  color: white;
}

:deep(.queue-filters__btn:hover) {
  background: var(--surface-600);
  border-color: var(--surface-500);
}

:deep(.queue-filters__btn .queue-filters__hidden-select) {
  position: absolute;
  inset: 0;
  opacity: 0;
  cursor: pointer;
}

/* Sort button */
:deep(.queue-filters__sort-btn) {
  font-size: 0.875rem;
  font-weight: 500;
  color: white;
  padding: 0.5rem;
}

:deep(.queue-filters__sort-btn:hover) {
  color: var(--primary-color);
}

/* View toggle buttons */
:deep(.queue-filters__view-btn) {
  width: 2.25rem;
  height: 2.25rem;
  padding: 0;
  color: var(--surface-300);
  border-radius: 0.5rem;
}

:deep(.queue-filters__view-btn:hover) {
  background: var(--surface-600);
  color: white;
}

:deep(.queue-filters__view-btn--active) {
  background: var(--surface-600);
  color: white;
}
</style>
