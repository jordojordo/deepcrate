<script setup lang="ts">
import type { CompletedDownload } from '@/types';

import { formatRelativeTime } from '@/utils/formatters';

import DataTable from 'primevue/datatable';
import Column from 'primevue/column';

interface Props {
  downloads: CompletedDownload[];
  loading?:  boolean;
}

defineProps<Props>();
</script>

<template>
  <div class="completed-downloads-list">
    <DataTable
      :value="downloads"
      :loading="loading"
      striped-rows
      class="downloads-table"
      :empty-message="loading ? 'Loading...' : 'No completed downloads'"
    >
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
    </DataTable>
  </div>
</template>

<style scoped>
.completed-downloads-list {
  width: 100%;
}
</style>
