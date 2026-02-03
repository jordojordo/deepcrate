<script setup lang="ts">
import type {
  WishlistFilters, WishlistSort, ProcessedFilter, WishlistItemSource, WishlistItemType 
} from '@/types/wishlist';

import Select from 'primevue/select';
import Button from 'primevue/button';

export type ViewMode = 'grid' | 'list';

const props = defineProps<{
  modelValue:    WishlistFilters;
  viewMode?:     ViewMode;
  selectedCount: number;
  allSelected:   boolean;
  someSelected:  boolean;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: WishlistFilters];
  'update:viewMode':   [value: ViewMode];
  'selectAll':         [];
  'clearSelection':    [];
  'bulkDelete':        [];
  'bulkRequeue':       [];
}>();

const sourceOptions: Array<{ label: string; value: WishlistItemSource | 'all' }> = [
  { label: 'All Sources', value: 'all' },
  { label: 'ListenBrainz', value: 'listenbrainz' },
  { label: 'Catalog', value: 'catalog' },
  { label: 'Manual', value: 'manual' },
];

const typeOptions: Array<{ label: string; value: WishlistItemType | 'all' }> = [
  { label: 'All Types', value: 'all' },
  { label: 'Albums', value: 'album' },
  { label: 'Tracks', value: 'track' },
  { label: 'Artists', value: 'artist' },
];

const processedOptions: Array<{ label: string; value: ProcessedFilter }> = [
  { label: 'All Items', value: 'all' },
  { label: 'Pending Download', value: 'pending' },
  { label: 'Processed', value: 'processed' },
];

const sortOptions: Array<{ label: string; value: WishlistSort }> = [
  { label: 'Date Added (Newest)', value: 'addedAt_desc' },
  { label: 'Date Added (Oldest)', value: 'addedAt_asc' },
  { label: 'Artist (A-Z)', value: 'artist_asc' },
  { label: 'Artist (Z-A)', value: 'artist_desc' },
  { label: 'Title (A-Z)', value: 'title_asc' },
  { label: 'Title (Z-A)', value: 'title_desc' },
];

function updateFilter<K extends keyof WishlistFilters>(key: K, value: WishlistFilters[K] | 'all') {
  const newValue = value === 'all' ? undefined : value;

  emit('update:modelValue', { ...props.modelValue, [key]: newValue });
}

function setViewMode(mode: ViewMode) {
  emit('update:viewMode', mode);
}

function handleSelectAll() {
  if (props.allSelected) {
    emit('clearSelection');
  } else {
    emit('selectAll');
  }
}
</script>

<template>
  <div class="wishlist-filters">
    <div class="wishlist-filters__row">
      <!-- Left: Filter dropdowns -->
      <div class="wishlist-filters__left">
        <Button
          class="wishlist-filters__btn"
          outlined
        >
          <span>{{ sourceOptions.find(o => o.value === (modelValue.source || 'all'))?.label }}</span>
          <i class="pi pi-chevron-down ml-2"></i>
          <Select
            :model-value="modelValue.source || 'all'"
            :options="sourceOptions"
            option-label="label"
            option-value="value"
            class="wishlist-filters__hidden-select"
            @update:model-value="updateFilter('source', $event)"
          />
        </Button>

        <Button
          class="wishlist-filters__btn"
          outlined
        >
          <span>{{ typeOptions.find(o => o.value === (modelValue.type || 'all'))?.label }}</span>
          <i class="pi pi-chevron-down ml-2"></i>
          <Select
            :model-value="modelValue.type || 'all'"
            :options="typeOptions"
            option-label="label"
            option-value="value"
            class="wishlist-filters__hidden-select"
            @update:model-value="updateFilter('type', $event)"
          />
        </Button>

        <Button
          class="wishlist-filters__btn"
          outlined
        >
          <span>{{ processedOptions.find(o => o.value === (modelValue.processed || 'all'))?.label }}</span>
          <i class="pi pi-chevron-down ml-2"></i>
          <Select
            :model-value="modelValue.processed || 'all'"
            :options="processedOptions"
            option-label="label"
            option-value="value"
            class="wishlist-filters__hidden-select"
            @update:model-value="updateFilter('processed', $event)"
          />
        </Button>

        <Button
          class="wishlist-filters__btn"
          outlined
        >
          <span>{{ sortOptions.find(o => o.value === modelValue.sort)?.label || 'Sort' }}</span>
          <i class="pi pi-chevron-down ml-2"></i>
          <Select
            :model-value="modelValue.sort || 'addedAt_desc'"
            :options="sortOptions"
            option-label="label"
            option-value="value"
            class="wishlist-filters__hidden-select"
            @update:model-value="updateFilter('sort', $event)"
          />
        </Button>
      </div>

      <!-- Right: Selection actions and view toggle -->
      <div class="wishlist-filters__right">
        <!-- Selection actions -->
        <template v-if="selectedCount > 0">
          <span class="wishlist-filters__selection-count">{{ selectedCount }} selected</span>
          <Button
            icon="pi pi-trash"
            severity="danger"
            text
            size="small"
            class="wishlist-filters__action-btn"
            @click="$emit('bulkDelete')"
          />
          <Button
            icon="pi pi-refresh"
            text
            size="small"
            class="wishlist-filters__action-btn"
            title="Re-queue for download"
            @click="$emit('bulkRequeue')"
          />
          <div class="wishlist-filters__divider"></div>
        </template>

        <!-- Select all toggle -->
        <Button
          :icon="allSelected ? 'pi pi-check-square' : someSelected ? 'pi pi-minus' : 'pi pi-stop'"
          text
          size="small"
          class="wishlist-filters__action-btn"
          title="Toggle select all"
          @click="handleSelectAll"
        />

        <div class="wishlist-filters__divider"></div>

        <!-- View toggle buttons -->
        <Button
          icon="pi pi-th-large"
          :class="['wishlist-filters__view-btn', { 'wishlist-filters__view-btn--active': viewMode === 'grid' }]"
          :text="viewMode !== 'grid'"
          aria-label="Grid View"
          @click="setViewMode('grid')"
        />
        <Button
          icon="pi pi-list"
          :class="['wishlist-filters__view-btn', { 'wishlist-filters__view-btn--active': viewMode === 'list' }]"
          :text="viewMode !== 'list'"
          aria-label="List View"
          @click="setViewMode('list')"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.wishlist-filters {
  padding: 0.75rem 0;
}

.wishlist-filters__row {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

@media (min-width: 640px) {
  .wishlist-filters__row {
    flex-direction: row;
    justify-content: space-between;
    align-items: center;
  }
}

.wishlist-filters__left {
  display: flex;
  gap: 0.75rem;
  overflow-x: auto;
  padding-bottom: 0.25rem;
  flex-wrap: wrap;
}

.wishlist-filters__right {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-left: auto;
}

.wishlist-filters__divider {
  width: 1px;
  height: 1rem;
  background: var(--r-border-default);
  margin: 0 0.5rem;
}

.wishlist-filters__selection-count {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--primary-color);
  margin-right: 0.5rem;
}

/* Filter button styling */
:deep(.wishlist-filters__btn) {
  position: relative;
  height: 2.25rem;
  padding: 0 1rem;
  font-size: 0.875rem;
  font-weight: 500;
  white-space: nowrap;
  background: var(--surface-card);
  border-color: var(--r-border-default);
  color: var(--r-text-primary);
}

:deep(.wishlist-filters__btn:hover) {
  background: var(--r-hover-bg);
  border-color: var(--r-border-emphasis);
}

:deep(.wishlist-filters__btn .wishlist-filters__hidden-select) {
  position: absolute;
  inset: 0;
  opacity: 0;
  cursor: pointer;
}

/* Action buttons */
:deep(.wishlist-filters__action-btn) {
  width: 2.25rem;
  height: 2.25rem;
  padding: 0;
  color: var(--r-text-muted);
}

:deep(.wishlist-filters__action-btn:hover) {
  background: var(--r-hover-bg);
  color: var(--r-text-primary);
}

/* View toggle buttons */
:deep(.wishlist-filters__view-btn) {
  width: 2.25rem;
  height: 2.25rem;
  padding: 0;
  color: var(--r-text-muted);
  border-radius: 0.5rem;
}

:deep(.wishlist-filters__view-btn:hover) {
  background: var(--r-hover-bg);
  color: var(--r-text-primary);
}

:deep(.wishlist-filters__view-btn--active) {
  background: var(--r-active-bg);
  color: var(--r-text-primary);
}
</style>
