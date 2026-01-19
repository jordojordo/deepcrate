<script setup lang="ts">
import type { FailedDownload } from '@/types';

import { ref } from 'vue';
import { formatRelativeTime } from '@/utils/formatters';

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

defineProps<Props>();
const emit = defineEmits<Emits>();

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
    emit('delete', ids);
    selectedDownloads.value = [];
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

    <DataTable
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
              @click="emit('delete', [data.id])"
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
</style>
