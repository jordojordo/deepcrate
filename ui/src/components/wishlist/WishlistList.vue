<script setup lang="ts">
import type { WishlistEntryWithStatus, DownloadStatus } from '@/types/wishlist';
import type { ComponentPublicInstance } from 'vue';

import { ref, watch, computed } from 'vue';
import { getDefaultCoverUrl } from '@/utils/formatters';
import { useBreakpoint } from '@/composables/useBreakpoint';

import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import Button from 'primevue/button';
import Tag from 'primevue/tag';
import ProgressSpinner from 'primevue/progressspinner';

interface Props {
  items:        WishlistEntryWithStatus[];
  loading:      boolean;
  selectedIds:  Set<string>;
  isProcessing: (id: string) => boolean;
  focusIndex?:  number;
}

const props = withDefaults(defineProps<Props>(), { focusIndex: -1 });
const { isMobile } = useBreakpoint(1100);

const emit = defineEmits<{
  select:               [id: string];
  edit:                 [item: WishlistEntryWithStatus];
  delete:               [id: string];
  requeue:              [id: string];
  'update:focus-index': [index: number];
  'selection-change':   [items: WishlistEntryWithStatus[]];
}>();

const tableRef = ref<ComponentPublicInstance | null>(null);

// Convert selectedIds Set to array of items for DataTable v-model
const selectedItems = computed({
  get: () => props.items.filter(item => props.selectedIds.has(item.id)),
  set: (items: WishlistEntryWithStatus[]) => {
    emit('selection-change', items);
  },
});

// Scroll focused row into view
watch(
  () => props.focusIndex,
  (index) => {
    if (index >= 0 && tableRef.value) {
      const table = tableRef.value.$el as HTMLElement;
      const rows = table.querySelectorAll('tbody tr');
      const row = rows[index] as HTMLElement | undefined;

      if (row) {
        row.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
  }
);

function getRowClass(data: WishlistEntryWithStatus): string | undefined {
  const index = props.items.findIndex(item => item.id === data.id);

  return index === props.focusIndex ? 'wishlist-list__row--focused' : undefined;
}

function handleRowClick(event: { data: WishlistEntryWithStatus; index: number }) {
  emit('update:focus-index', event.index);
}

function handleEdit(item: WishlistEntryWithStatus) {
  emit('edit', item);
}

function handleDelete(id: string) {
  emit('delete', id);
}

function handleRequeue(id: string) {
  emit('requeue', id);
}

function getSourceSeverity(source: string | null | undefined): 'info' | 'secondary' | 'warn' {
  if (source === 'listenbrainz') {
    return 'info';
  }
  if (source === 'catalog') {
    return 'secondary';
  }

  return 'warn';
}

function getSourceLabel(source: string | null | undefined): string {
  if (source === 'listenbrainz') {
    return 'ListenBrainz';
  }
  if (source === 'catalog') {
    return 'Catalog';
  }

  return 'Manual';
}

function getStatusSeverity(status: DownloadStatus): 'success' | 'info' | 'warn' | 'danger' | 'secondary' {
  const map: Record<DownloadStatus, 'success' | 'info' | 'warn' | 'danger' | 'secondary'> = {
    none:              'secondary',
    pending:           'info',
    searching:         'info',
    pending_selection: 'warn',
    deferred:          'secondary',
    queued:            'info',
    downloading:       'info',
    completed:         'success',
    failed:            'danger',
  };

  return map[status] || 'secondary';
}

function getStatusLabel(status: DownloadStatus): string {
  const map: Record<DownloadStatus, string> = {
    none:              'Pending',
    pending:           'Queued',
    searching:         'Searching',
    pending_selection: 'Select',
    deferred:          'Deferred',
    queued:            'Downloading',
    downloading:       'Downloading',
    completed:         'Downloaded',
    failed:            'Failed',
  };

  return map[status] || 'Unknown';
}

function canRequeue(status: DownloadStatus): boolean {
  return ['none', 'failed', 'completed'].includes(status);
}
</script>

<template>
  <div>
    <div v-if="loading && !items?.length" class="flex justify-content-center py-6">
      <ProgressSpinner style="width: 64px; height: 64px" />
    </div>

    <div
      v-else-if="items.length === 0"
      class="surface-card border-round-lg p-8 text-center"
    >
      <i class="pi pi-heart text-6xl text-muted mb-4"></i>
      <h3 class="text-xl font-semibold mb-2">No wishlist items</h3>
      <p class="text-muted">Items you approve from the queue will appear here.</p>
    </div>

    <!-- Mobile card view -->
    <div v-else-if="isMobile" class="wishlist-mobile">
      <div
        v-for="(item, index) in items"
        :key="item.id"
        class="wishlist-mobile__card"
        :class="{ 'wishlist-mobile__card--focused': index === props.focusIndex }"
        @click="emit('update:focus-index', index)"
      >
        <div class="wishlist-mobile__header">
          <img
            :src="item.coverUrl || getDefaultCoverUrl()"
            :alt="`${item.title} cover`"
            class="wishlist-mobile__cover"
            @error="($event.target as HTMLImageElement).src = getDefaultCoverUrl()"
          />
          <div class="wishlist-mobile__info">
            <div class="font-semibold">{{ item.title || 'Unknown' }}</div>
            <div class="text-sm text-muted">{{ item.artist }}</div>
            <div v-if="item.year" class="text-sm text-muted">{{ item.year }}</div>
          </div>
        </div>
        <div class="wishlist-mobile__tags">
          <Tag
            :value="getSourceLabel(item.source)"
            :severity="getSourceSeverity(item.source)"
          />
          <Tag
            :value="getStatusLabel(item.downloadStatus)"
            :severity="getStatusSeverity(item.downloadStatus)"
          />
          <Tag
            v-if="item.type !== 'album'"
            :value="item.type"
            severity="secondary"
          />
        </div>
        <div v-if="item.downloadStatus === 'failed' && item.downloadError" class="text-xs text-red-400">
          {{ item.downloadError }}
        </div>
        <div class="wishlist-mobile__actions">
          <Button
            v-if="canRequeue(item.downloadStatus)"
            icon="pi pi-refresh"
            severity="info"
            size="small"
            text
            :loading="isProcessing(item.id)"
            :disabled="isProcessing(item.id)"
            @click.stop="handleRequeue(item.id)"
          />
          <Button
            icon="pi pi-pencil"
            severity="secondary"
            size="small"
            text
            :disabled="isProcessing(item.id)"
            @click.stop="handleEdit(item)"
          />
          <Button
            icon="pi pi-trash"
            severity="danger"
            size="small"
            text
            :loading="isProcessing(item.id)"
            :disabled="isProcessing(item.id)"
            @click.stop="handleDelete(item.id)"
          />
        </div>
      </div>
    </div>

    <!-- Desktop DataTable view -->
    <DataTable
      v-else
      ref="tableRef"
      :value="items"
      v-model:selection="selectedItems"
      data-key="id"
      :loading="loading"
      striped-rows
      responsive-layout="scroll"
      :row-class="getRowClass"
      @row-click="handleRowClick"
    >
      <Column selection-mode="multiple" header-style="width: 3rem"></Column>

      <Column field="coverUrl" header="Cover" style="width: 100px">
        <template #body="{ data }">
          <img
            :src="data.coverUrl || getDefaultCoverUrl()"
            :alt="`${data.title} cover`"
            class="w-16 h-16 border-round object-cover"
            @error="($event.target as HTMLImageElement).src = getDefaultCoverUrl()"
          />
        </template>
      </Column>

      <Column field="title" header="Title">
        <template #body="{ data }">
          <div>
            <div class="font-semibold">{{ data.title || 'Unknown' }}</div>
            <div class="text-sm text-muted">{{ data.artist }}</div>
            <div v-if="data.year" class="text-sm text-muted mt-1">{{ data.year }}</div>
          </div>
        </template>
      </Column>

      <Column field="source" header="Source" style="width: 130px">
        <template #body="{ data }">
          <div class="flex flex-column gap-1">
            <Tag
              :value="getSourceLabel(data.source)"
              :severity="getSourceSeverity(data.source)"
            />
            <Tag
              v-if="data.type !== 'album'"
              :value="data.type"
              severity="secondary"
            />
          </div>
        </template>
      </Column>

      <Column field="downloadStatus" header="Status" style="width: 130px">
        <template #body="{ data }">
          <Tag
            :value="getStatusLabel(data.downloadStatus)"
            :severity="getStatusSeverity(data.downloadStatus)"
          />
          <div v-if="data.downloadStatus === 'failed' && data.downloadError" class="text-xs text-red-400 mt-1">
            {{ data.downloadError }}
          </div>
        </template>
      </Column>

      <Column field="addedAt" header="Added" style="width: 120px">
        <template #body="{ data }">
          <span class="text-sm">{{ new Date(data.addedAt).toLocaleDateString() }}</span>
        </template>
      </Column>

      <Column header="Actions" style="width: 140px">
        <template #body="{ data }">
          <div class="flex gap-2">
            <Button
              v-if="canRequeue(data.downloadStatus)"
              icon="pi pi-refresh"
              severity="info"
              size="small"
              text
              :loading="isProcessing(data.id)"
              :disabled="isProcessing(data.id)"
              title="Re-queue for download"
              @click.stop="handleRequeue(data.id)"
            />
            <Button
              icon="pi pi-pencil"
              severity="secondary"
              size="small"
              text
              :disabled="isProcessing(data.id)"
              title="Edit"
              @click.stop="handleEdit(data)"
            />
            <Button
              icon="pi pi-trash"
              severity="danger"
              size="small"
              text
              :loading="isProcessing(data.id)"
              :disabled="isProcessing(data.id)"
              title="Delete"
              @click.stop="handleDelete(data.id)"
            />
          </div>
        </template>
      </Column>
    </DataTable>

    <div v-if="loading && items.length > 0" class="flex justify-content-center py-4">
      <ProgressSpinner style="width: 48px; height: 48px" />
    </div>
  </div>
</template>

<style scoped>
/* Mobile card view */
.wishlist-mobile {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.wishlist-mobile__card {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: 0.75rem;
  border-radius: 0.5rem;
  border: 1px solid var(--r-border-default);
  background: var(--p-card-background);
}

.wishlist-mobile__card--focused {
  background-color: rgba(var(--primary-500-rgb, 99, 102, 241), 0.15);
  outline: 2px solid var(--primary-500);
  outline-offset: -2px;
}

.wishlist-mobile__header {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
}

.wishlist-mobile__cover {
  width: 3rem;
  height: 3rem;
  border-radius: 0.25rem;
  object-fit: cover;
  flex-shrink: 0;
}

.wishlist-mobile__info {
  flex: 1;
  min-width: 0;
}

.wishlist-mobile__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.375rem;
}

.wishlist-mobile__actions {
  display: flex;
  gap: 0.5rem;
  justify-content: flex-end;
}

:deep(.wishlist-list__row--focused) {
  background-color: rgba(var(--primary-500-rgb, 99, 102, 241), 0.15) !important;
  outline: 2px solid var(--primary-500);
  outline-offset: -2px;
}

:deep(.wishlist-list__row--focused td) {
  background-color: transparent !important;
}
</style>
