<script setup lang="ts">
import type { ActivityItem } from '@/types';
import type { DataTablePageEvent } from 'primevue/datatable';

import { getDefaultCoverUrl, formatRelativeTime } from '@/utils/formatters';
import { getActivityMeta, getAcivityIconStyle } from '@/utils/activityMeta';

import DataTable from 'primevue/datatable';
import Column from 'primevue/column';

interface Props {
  items:         ActivityItem[];
  loading?:      boolean;
  paginator?:    boolean;
  lazy?:         boolean;
  rows?:         number;
  totalRecords?: number;
  first?:        number;
}

withDefaults(defineProps<Props>(), {
  loading:      false,
  paginator:    false,
  lazy:         false,
  rows:         50,
  totalRecords: 0,
  first:        0,
});

const emit = defineEmits<{
  page: [event: DataTablePageEvent];
}>();
</script>

<template>
  <DataTable
    :value="items"
    data-key="id"
    striped-rows
    responsive-layout="scroll"
    :lazy="lazy"
    :paginator="paginator"
    :rows="rows"
    :total-records="totalRecords"
    :first="first"
    :loading="loading"
    class="activity-table"
    :pt="{ thead: { style: { display: 'none' } } }"
    @page="emit('page', $event)"
  >
    <Column style="width: 70px">
      <template #body="{ data }">
        <div class="activity-table__cover">
          <img
            :src="data.coverUrl || getDefaultCoverUrl()"
            :alt="data.title"
            class="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
            @error="($event.target as HTMLImageElement).src = getDefaultCoverUrl()"
          />
        </div>
      </template>
    </Column>

    <Column>
      <template #body="{ data }">
        <div class="flex flex-column justify-content-center min-w-0">
          <p class="text-sm font-medium truncate">
            {{ data.title }}
          </p>
          <div class="flex align-items-center gap-2 text-xs mt-1">
            <i
              :class="['pi', getActivityMeta(data.type).icon, 'text-xs']"
              :style="getAcivityIconStyle(data.type)"
            />
            <span>{{ data.description }}</span>
          </div>
        </div>
      </template>
    </Column>

    <Column style="width: 100px">
      <template #body="{ data }">
        <span class="text-xs white-space-nowrap">
          {{ formatRelativeTime(data.timestamp) }}
        </span>
      </template>
    </Column>

    <template #empty>
      <div class="text-center py-8">
        <i class="pi pi-inbox text-4xl mb-3"></i>
        <p class="text-sm">No activity found</p>
      </div>
    </template>
  </DataTable>
</template>

<style lang="scss" scoped>
.activity-table {
  &__cover {
    width: 3rem;
    height: 3rem;
    border-radius: 0.375rem;
    background-color: var(--surface-card);
    flex-shrink: 0;
    overflow: hidden;
    border: 1px solid var(--r-border-default);
  }
}
</style>
