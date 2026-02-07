<script setup lang="ts">
import type { FailedDownload } from '@/types';

import { ref } from 'vue';
import { useConfirm } from 'primevue/useconfirm';
import { formatRelativeTime } from '@/utils/formatters';
import { useBreakpoint } from '@/composables/useBreakpoint';

import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import Button from 'primevue/button';

import EmptyState from '@/components/common/EmptyState.vue';

interface Props {
  downloads: FailedDownload[];
  loading?:  boolean;
}

interface Emits {
  (e: 'retry', ids: string[]): void;
  (e: 'delete', ids: string[]): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();
const confirm = useConfirm();
const { isMobile } = useBreakpoint(1100);

const selectedDownloads = ref<FailedDownload[]>([]);

const handleRetry = () => {
  const ids = selectedDownloads.value.map((d) => d.id);

  if (ids.length) {
    emit('retry', ids);
    selectedDownloads.value = [];
  }
};

const handleDelete = () => {
  const ids = selectedDownloads.value.map((d) => d.id);

  if (ids.length) {
    confirm.require({
      message: `Delete ${ ids.length } selected download(s)?`,
      header:  'Confirm Delete',
      icon:    'pi pi-exclamation-triangle',
      accept:  () => {
        emit('delete', ids);
        selectedDownloads.value = [];
      },
    });
  }
};
</script>

<template>
  <div class="failed-downloads-list">
    <div class="flex justify-content-end gap-2 mb-3" v-if="downloads.length">
      <Button
        label="Retry Selected"
        icon="pi pi-refresh"
        severity="warning"
        :disabled="!selectedDownloads.length"
        @click="handleRetry"
      />
      <Button
        label="Delete Selected"
        icon="pi pi-trash"
        severity="danger"
        :disabled="!selectedDownloads.length"
        @click="handleDelete"
      />
    </div>

    <!-- Mobile card view -->
    <div v-if="isMobile && props.downloads.length > 0" class="failed-mobile">
      <div
        v-for="download in props.downloads"
        :key="download.id"
        class="failed-mobile__card"
      >
        <div class="failed-mobile__header">
          <div class="failed-mobile__info">
            <div class="font-semibold">{{ download.artist }}</div>
            <div class="text-sm text-surface-400">{{ download.album }}</div>
          </div>
        </div>
        <div class="text-sm text-red-400 failed-mobile__error">
          {{ download.errorMessage || 'Unknown error' }}
        </div>
        <div class="failed-mobile__meta">
          <span class="text-sm">{{ download.retryCount }} retries</span>
          <span class="text-sm text-surface-400">{{ formatRelativeTime(download.completedAt) }}</span>
        </div>
        <div class="failed-mobile__actions">
          <Button
            icon="pi pi-refresh"
            severity="warning"
            size="small"
            outlined
            @click="emit('retry', [download.id])"
          />
          <Button
            icon="pi pi-trash"
            severity="danger"
            size="small"
            outlined
            @click="confirm.require({
              message: `Delete failed download for ${download.artist} - ${download.album}?`,
              header: 'Confirm Delete',
              icon: 'pi pi-exclamation-triangle',
              accept: () => emit('delete', [download.id]),
            })"
          />
        </div>
      </div>
    </div>

    <!-- Empty state (both mobile and desktop) -->
    <EmptyState
      v-else-if="props.downloads.length === 0 && !loading"
      icon="pi-check-circle"
      title="No failed downloads"
      message="All downloads completed successfully"
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
          title="No failed downloads"
          message="All downloads completed successfully"
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

      <Column field="errorMessage" header="Error" style="max-width: 300px">
        <template #body="{ data }">
          <span class="text-sm text-red-400">{{ data.errorMessage || 'Unknown error' }}</span>
        </template>
      </Column>

      <Column field="retryCount" header="Retries" sortable>
        <template #body="{ data }">
          <span class="text-sm">{{ data.retryCount }}</span>
        </template>
      </Column>

      <Column field="completedAt" header="Failed At" sortable>
        <template #body="{ data }">
          <span class="text-sm text-surface-400">{{ formatRelativeTime(data.completedAt) }}</span>
        </template>
      </Column>

      <Column header="Actions">
        <template #body="{ data }">
          <div class="flex gap-1">
            <Button
              icon="pi pi-refresh"
              severity="warning"
              size="small"
              outlined
              @click="emit('retry', [data.id])"
            />
            <Button
              icon="pi pi-trash"
              severity="danger"
              size="small"
              outlined
              @click="confirm.require({
                message: `Delete failed download for ${data.artist} - ${data.album}?`,
                header: 'Confirm Delete',
                icon: 'pi pi-exclamation-triangle',
                accept: () => emit('delete', [data.id]),
              })"
            />
          </div>
        </template>
      </Column>
    </DataTable>
  </div>
</template>

<style scoped>
.failed-downloads-list {
  width: 100%;
}

/* Mobile card view */
.failed-mobile {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.failed-mobile__card {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: 0.75rem;
  border-radius: 0.5rem;
  border: 1px solid var(--r-border-default);
  background: var(--p-card-background);
}

.failed-mobile__header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 0.5rem;
}

.failed-mobile__info {
  flex: 1;
  min-width: 0;
}

.failed-mobile__error {
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.failed-mobile__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
}

.failed-mobile__actions {
  display: flex;
  gap: 0.5rem;
  justify-content: flex-end;
}
</style>
