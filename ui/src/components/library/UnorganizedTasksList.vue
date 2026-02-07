<script setup lang="ts">
import type { UnorganizedTask } from '@/types';

import { formatRelativeTime } from '@/utils/formatters';
import { useBreakpoint } from '@/composables/useBreakpoint';

import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import Button from 'primevue/button';

import EmptyState from '@/components/common/EmptyState.vue';

const props = defineProps<{
  tasks:   UnorganizedTask[];
  total:   number;
  loading: boolean;
  hasMore: boolean;
}>();

const emit = defineEmits<{
  loadMore: [];
}>();

const { isMobile } = useBreakpoint(900);
</script>

<template>
  <div class="unorganized-tasks">
    <!-- Mobile card view -->
    <div v-if="isMobile && props.tasks.length > 0" class="unorganized-mobile">
      <div
        v-for="task in props.tasks"
        :key="task.id"
        class="unorganized-mobile__card"
      >
        <div class="unorganized-mobile__info">
          <div class="font-semibold">{{ task.artist }}</div>
          <div class="text-sm text-surface-400">{{ task.album }}</div>
        </div>
        <div class="unorganized-mobile__meta">
          <span class="text-sm">{{ task.type }}</span>
          <span class="text-sm text-surface-400">
            {{ task.completedAt ? formatRelativeTime(task.completedAt) : 'Unknown' }}
          </span>
        </div>
      </div>
    </div>

    <!-- Empty state (both mobile and desktop) -->
    <EmptyState
      v-else-if="props.tasks.length === 0 && !loading"
      icon="pi-check-circle"
      title="No unorganized downloads"
      message="All your downloads have been organized into your library"
    />

    <!-- Desktop DataTable view -->
    <DataTable
      v-else
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

/* Mobile card view */
.unorganized-mobile {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.unorganized-mobile__card {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: 0.75rem;
  border-radius: 0.5rem;
  border: 1px solid var(--r-border-default);
  background: var(--p-card-background);
}

.unorganized-mobile__info {
  flex: 1;
  min-width: 0;
}

.unorganized-mobile__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
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

