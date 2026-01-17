<script setup lang="ts">
import type { ActiveDownload } from '@/types';

import { formatRelativeTime } from '@/utils/formatters';

import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import Tag from 'primevue/tag';

import DownloadProgress from './DownloadProgress.vue';

interface Props {
  downloads: ActiveDownload[];
  loading?:  boolean;
}

defineProps<Props>();

const getStatusSeverity = (status: string) => {
  const severityMap: Record<string, 'success' | 'info' | 'warning' | 'danger' | 'secondary' | 'contrast' | undefined> = {
    downloading: 'success',
    searching:   'info',
    queued:      'warning',
    deferred:    'contrast',
    pending:     'secondary',
  };

  return severityMap[status] || 'secondary';
};
</script>

<template>
  <div class="active-downloads-list">
    <DataTable
      :value="downloads"
      :loading="loading"
      striped-rows
      class="downloads-table"
      :empty-message="loading ? 'Loading...' : 'No active downloads'"
    >
      <Column field="artist" header="Artist" sortable>
        <template #body="{ data }">
          <div>
            <div class="font-semibold">{{ data.artist }}</div>
            <div class="text-sm text-surface-400">{{ data.album }}</div>
          </div>
        </template>
      </Column>

      <Column field="status" header="Status" sortable>
        <template #body="{ data }">
          <Tag :value="data.status" :severity="getStatusSeverity(data.status)" />
        </template>
      </Column>

      <Column header="Progress" style="min-width: 300px">
        <template #body="{ data }">
          <DownloadProgress v-if="data.progress" :progress="data.progress" />
          <span v-else class="text-surface-400 text-sm">Waiting...</span>
        </template>
      </Column>

      <Column field="slskdUsername" header="Source" sortable>
        <template #body="{ data }">
          <span class="text-sm">{{ data.slskdUsername || 'N/A' }}</span>
        </template>
      </Column>

      <Column field="queuedAt" header="Queued" sortable>
        <template #body="{ data }">
          <span class="text-sm text-surface-400">{{ formatRelativeTime(data.queuedAt) }}</span>
        </template>
      </Column>
    </DataTable>
  </div>
</template>

<style scoped>
.active-downloads-list {
  width: 100%;
}
</style>
