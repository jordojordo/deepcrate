<script setup lang="ts">
import type { QueueFilters, ViewMode } from '@/types';

import { SORT_OPTIONS } from '@/constants/queue';

import Select from 'primevue/select';
import MultiSelect from 'primevue/multiselect';
import Button from 'primevue/button';
import ToggleSwitch from 'primevue/toggleswitch';

const sortOptions = [...SORT_OPTIONS];

const props = defineProps<{
  modelValue:      QueueFilters;
  loading:         boolean;
  viewMode?:       ViewMode;
  availableGenres: string[];
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
        <Select
          :model-value="modelValue.source"
          @update:model-value="updateFilter('source', $event)"
          :options="sourceOptions"
          option-label="label"
          option-value="value"
          class="queue-filters__select"
        >
          <template #value="{ value }">
            <span>Source: {{ sourceOptions.find(o => o.value === value)?.label }}</span>
          </template>
        </Select>

        <Select
          :model-value="modelValue.sort"
          @update:model-value="updateFilter('sort', $event)"
          :options="sortOptions"
          option-label="label"
          option-value="value"
          class="queue-filters__select"
        >
          <template #value="{ value }">
            <span>Sort: {{ sortOptions.find(o => o.value === value)?.label }}</span>
          </template>
        </Select>

        <MultiSelect
          v-if="availableGenres.length > 0"
          :model-value="modelValue.genres || []"
          :loading="loading"
          :max-selected-labels="2"
          :options="availableGenres"
          :virtual-scroller-options="{ itemSize: 44 }"
          filter
          class="queue-filters__select"
          placeholder="Genres"
          @update:model-value="updateFilter('genres', $event.length ? $event : undefined)"
        />
      </div>

      <!-- Right: Sort direction, hide owned, and view toggle -->
      <div class="queue-filters__right">
        <Button
          :icon="modelValue.order === 'desc' ? 'pi pi-arrow-down' : 'pi pi-arrow-up'"
          class="queue-filters__view-btn"
          :aria-label="modelValue.order === 'desc' ? 'Sort descending' : 'Sort ascending'"
          text
          @click="toggleOrder"
        />

        <div class="queue-filters__divider"></div>

        <!-- Hide owned toggle -->
        <label class="queue-filters__toggle">
          <ToggleSwitch
            :model-value="modelValue.hide_in_library ?? false"
            @update:model-value="updateFilter('hide_in_library', $event)"
          />
          <span class="queue-filters__toggle-label">Hide Owned</span>
        </label>

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

<style lang="scss" scoped>
.queue-filters {
  padding: 0.75rem 0;

  &__row {
    display: flex;
    flex-direction: column;
    gap: 1rem;

    @media (min-width: 640px) {
      flex-direction: row;
      justify-content: space-between;
      align-items: center;
    }
  }

  &__left {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
    overflow-x: auto;
    padding-bottom: 0.25rem;

    @media (max-width: 768px) {
      flex-direction: column;
    }
  }

  &__right {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-left: auto;

    @media (max-width: 640px) {
      margin-left: 0;
      justify-content: space-around;
    }
  }

  &__divider {
    width: 1px;
    height: 1rem;
    background: var(--r-border-default);
    margin: 0 0.5rem;
  }

  &__toggle {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    cursor: pointer;

    &:hover &-label {
      color: var(--r-text-primary);
    }
  }

  &__toggle-label {
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--r-text-muted);
    white-space: nowrap;
  }

  &__select {
    &:hover {
      background: var(--r-hover-bg);
      border-color: var(--r-border-emphasis);
    }

    .p-select-label {
      padding: 0 0.75rem;
      display: flex;
      align-items: center;
    }


    :deep(.p-multiselect-label.p-placeholder) {
      color: var(--p-select-color);
    }
  }

  &__view-btn {
    width: 2.25rem;
    height: 2.25rem;
    padding: 0;
    color: var(--r-text-muted);
    border-radius: 0.5rem;

    &:hover {
      background: var(--r-hover-bg);
      color: var(--r-text-primary);
    }

    &--active {
      background: var(--r-active-bg);
      color: var(--r-text-primary);
    }
  }
}
</style>
