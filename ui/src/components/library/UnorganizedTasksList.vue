<script setup lang="ts">
import type { UnorganizedTask } from '@/types';

import { formatRelativeTime } from '@/utils/formatters';

import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import Button from 'primevue/button';

import EmptyState from '@/components/common/EmptyState.vue';

defineProps<{
  tasks:   UnorganizedTask[];
  total:   number;
  loading: boolean;
  hasMore: boolean;
}>();

const emit = defineEmits<{
  loadMore: [];
}>();
</script>

<template>
  <div class="unorganized-tasks">
    <DataTable
      :value="tasks"
      :loading="loading"
      striped-rows
      class="downloads-table"
    >
      <template #empty>
        <EmptyState
          icon="pi-check-circle"
          title="No unorganized downloads"
          message="All your downloads have been organized into your library"
        />
      </template>
      <Column field="artist" header="Artist" sortable>
        <template #body="{ data }">
          <div>
            <div class="font-semibold">{{ data.artist }}</div>
            <div class="text-sm text-surface-400">{{ data.album }}</div>
          </div>
        </template>
      </Column>

      <Column field="type" header="Type" sortable style="width: 120px">
        <template #body="{ data }">
          <span class="text-sm">{{ data.type }}</span>
        </template>
      </Column>

      <Column field="completedAt" header="Completed" sortable style="width: 180px">
        <template #body="{ data }">
          <span class="text-sm text-surface-400">
            {{ data.completedAt ? formatRelativeTime(data.completedAt) : 'Unknown' }}
          </span>
        </template>
      </Column>
    </DataTable>

    <div v-if="hasMore && !loading" class="unorganized-tasks__load-more">
      <Button
        label="Load More"
        icon="pi pi-angle-down"
        outlined
        @click="emit('loadMore')"
      />
      <span class="unorganized-tasks__count">{{ tasks.length }} / {{ total }}</span>
    </div>
  </div>
</template>

<style scoped>
.unorganized-tasks {
  width: 100%;
}

.unorganized-tasks__load-more {
  margin-top: 1rem;
  display: flex;
  align-items: center;
  gap: 1rem;
}

.unorganized-tasks__count {
  color: var(--surface-300);
  font-size: 0.75rem;
}
</style>

