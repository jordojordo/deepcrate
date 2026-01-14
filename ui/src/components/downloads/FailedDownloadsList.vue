<script setup lang="ts">
import type { FailedDownload } from '@/types';

import { ref } from 'vue';
import { formatRelativeTime } from '@/utils/formatters';

import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import Button from 'primevue/button';

interface Props {
  downloads: FailedDownload[];
  loading?:  boolean;
}

interface Emits {
  (e: 'retry', ids: string[]): void;
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
</script>

<template>
  <div class="failed-downloads-list">
    <div class="flex justify-content-end mb-3" v-if="downloads.length">
      <Button
        label="Retry Selected"
        icon="pi pi-refresh"
        severity="warning"
        :disabled="!selectedDownloads.length"
        @click="handleRetry"
      />
    </div>

    <DataTable
      v-model:selection="selectedDownloads"
      :value="downloads"
      :loading="loading"
      striped-rows
      class="downloads-table"
      :empty-message="loading ? 'Loading...' : 'No failed downloads'"
      selection-mode="multiple"
      data-key="id"
    >
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
          <Button
            icon="pi pi-refresh"
            severity="warning"
            size="small"
            outlined
            @click="emit('retry', [data.id])"
          />
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
