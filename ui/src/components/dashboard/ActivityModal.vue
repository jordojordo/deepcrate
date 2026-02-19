<script setup lang="ts">
import type { DataTablePageEvent } from 'primevue/datatable';

import { computed, onMounted } from 'vue';

import { useBreakpoint } from '@/composables/useBreakpoint';
import { useActivity } from '@/composables/useActivity';

import Dialog from 'primevue/dialog';
import ActivityTableContent from '@/components/dashboard/ActivityTableContent.vue';

withDefaults(defineProps<{
  visible: boolean;
}>(), {});

const emit = defineEmits<{
  (e: 'close', value: void): void;
}>();

const { isMobile } = useBreakpoint();
const {
  paginatedItems,
  paginatedLoading,
  total,
  currentOffset,
  fetchPage,
  resetPaginated,
} = useActivity();

onMounted(() => {
  fetchPage(0);
});

const handleClose = () => {
  resetPaginated();
  emit('close');
};

const dialogMobileStyle = computed(() => {
  if (isMobile.value) {
    return {
      width:    '100vw',
      maxWidth: '98vw',
    };
  }

  return undefined;
});

function onPage(event: DataTablePageEvent) {
  fetchPage(event.first);
}
</script>

<template>
  <Dialog
    :visible="visible"
    :modal="true"
    :closable="true"
    :draggable="false"
    :style="dialogMobileStyle"
    header="Recent Activity"
    @update:visible="handleClose"
  >
    <div class="activity-modal">
      <ActivityTableContent
        :items="paginatedItems"
        :loading="paginatedLoading"
        paginator
        lazy
        :rows="50"
        :total-records="total"
        :first="currentOffset"
        @page="onPage"
      />
    </div>
  </Dialog>
</template>

<style lang="scss" scoped>
.activity-modal {
  min-width: 400px;

  @media (max-width: 768px) {
    min-width: unset;
  }
}
</style>
