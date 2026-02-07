<script setup lang="ts">
import type { CompletedDownload } from '@/types';

import { ref } from 'vue';
import { formatRelativeTime } from '@/utils/formatters';
import { useBreakpoint } from '@/composables/useBreakpoint';

import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import Button from 'primevue/button';

import EmptyState from '@/components/common/EmptyState.vue';

interface Props {
  downloads: CompletedDownload[];
  loading?:  boolean;
}

interface Emits {
  (e: 'delete', ids: string[]): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const { isMobile } = useBreakpoint(1100);
const selectedDownloads = ref<CompletedDownload[]>([]);

const handleDelete = () => {
  const ids = selectedDownloads.value.map((d) => d.id);

  if (ids.length) {
    emit('delete', ids);
    selectedDownloads.value = [];
  }
};
</script>

<template>
  <div class="completed-downloads-list">
    <div class="flex justify-content-end mb-3" v-if="downloads.length">
      <Button
        label="Delete Selected"
        icon="pi pi-trash"
        severity="danger"
        :disabled="!selectedDownloads.length"
        @click="handleDelete"
      />
    </div>

    <!-- Mobile card view -->
    <div v-if="isMobile && props.downloads.length > 0" class="completed-mobile">
      <div
        v-for="download in props.downloads"
        :key="download.id"
        class="completed-mobile__card"
      >
        <div class="completed-mobile__header">
          <div class="completed-mobile__info">
            <div class="font-semibold">{{ download.artist }}</div>
            <div class="text-sm text-surface-400">{{ download.album }}</div>
          </div>
          <Button
            icon="pi pi-trash"
            severity="danger"
            size="small"
            outlined
            @click="emit('delete', [download.id])"
          />
        </div>
        <div class="completed-mobile__meta">
          <span class="text-sm">{{ download.slskdUsername || 'N/A' }}</span>
          <span class="text-sm text-surface-400">{{ download.fileCount || 0 }} files</span>
          <span class="text-sm text-surface-400">{{ formatRelativeTime(download.completedAt) }}</span>
        </div>
      </div>
    </div>

    <!-- Empty state (both mobile and desktop) -->
    <EmptyState
      v-else-if="props.downloads.length === 0 && !loading"
      icon="pi-check-circle"
      title="No completed downloads yet"
      message="Finished downloads will be listed here"
    />

    <!-- Desktop DataTable view -->
    <DataTable
      v-else
      v-model:selection="selectedDownloads"
      :value="downloads"
      :loading="loading"
      striped-rows
      class="downloads-table"
      selection-mode="multiple"
      data-key="id"
    >
      <template #empty>
        <EmptyState
          icon="pi-check-circle"
          title="No completed downloads yet"
          message="Finished downloads will be listed here"
        />
      </template>
      <Column selection-mode="multiple" header-style="width: 3rem"></Column>

      <Column field="artist" header="Artist" sortable>
        <template #body="{ data }">
          <div>
            <div class="font-semibold">{{ data.artist }}</div>
            <div class="text-sm text-surface-400">{{ data.album }}</div>
          </div>
        </template>
      </Column>

      <Column field="slskdUsername" header="Source" sortable>
        <template #body="{ data }">
          <span class="text-sm">{{ data.slskdUsername || 'N/A' }}</span>
        </template>
      </Column>

      <Column field="fileCount" header="Files" sortable>
        <template #body="{ data }">
          <span class="text-sm">{{ data.fileCount || 'N/A' }}</span>
        </template>
      </Column>

      <Column field="queuedAt" header="Queued" sortable>
        <template #body="{ data }">
          <span class="text-sm text-surface-400">{{ formatRelativeTime(data.queuedAt) }}</span>
        </template>
      </Column>

      <Column field="completedAt" header="Completed" sortable>
        <template #body="{ data }">
          <span class="text-sm text-surface-400">{{ formatRelativeTime(data.completedAt) }}</span>
        </template>
      </Column>

      <Column header="Actions">
        <template #body="{ data }">
          <Button
            icon="pi pi-trash"
            severity="danger"
            size="small"
            outlined
            @click="emit('delete', [data.id])"
          />
        </template>
      </Column>
    </DataTable>
  </div>
</template>

<style scoped>
.completed-downloads-list {
  width: 100%;
}

/* Mobile card view */
.completed-mobile {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.completed-mobile__card {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: 0.75rem;
  border-radius: 0.5rem;
  border: 1px solid var(--r-border-default);
  background: var(--p-card-background);
}

.completed-mobile__header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 0.5rem;
}

.completed-mobile__info {
  flex: 1;
  min-width: 0;
}

.completed-mobile__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
}
</style>
