<script setup lang="ts">
import type { CompletedDownload } from '@/types';

import { ref } from 'vue';
import { formatRelativeTime } from '@/utils/formatters';

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

defineProps<Props>();
const emit = defineEmits<Emits>();

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
</style>
