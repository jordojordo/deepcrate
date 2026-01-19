<script setup lang="ts">
import type { QueueItem } from '@/types/queue';
import QueueItemCard from './QueueItemCard.vue';
import ProgressSpinner from 'primevue/progressspinner';
import EmptyState from '@/components/common/EmptyState.vue';

interface Props {
  items:         QueueItem[];
  loading?:      boolean;
  isProcessing?: (mbid: string) => boolean;
}

const props = withDefaults(defineProps<Props>(), {
  loading:      false,
  isProcessing: () => false,
});

const emit = defineEmits<{
  approve: [mbids: string[]];
  reject:  [mbids: string[]];
  preview: [item: QueueItem];
}>();

const handleApprove = (mbid: string) => {
  emit('approve', [mbid]);
};

const handleReject = (mbid: string) => {
  emit('reject', [mbid]);
};

const handlePreview = (item: QueueItem) => {
  emit('preview', item);
};
</script>

<template>
  <div class="queue-grid">
    <div v-if="loading && items.length === 0" class="queue-grid__loading">
      <ProgressSpinner style="width: 48px; height: 48px" />
    </div>

    <EmptyState
      v-else-if="!loading && items.length === 0"
      icon="pi-inbox"
      title="No pending items"
      message="New music recommendations will appear here when discovered"
    />

    <div v-else class="queue-grid__items">
      <QueueItemCard
        v-for="item in items"
        :key="item.mbid"
        :item="item"
        :processing="props.isProcessing(item.mbid)"
        @approve="handleApprove"
        @reject="handleReject"
        @preview="handlePreview"
      />
    </div>
  </div>
</template>

<style scoped>
.queue-grid {
  width: 100%;
  overflow-anchor: auto;
}

.queue-grid__loading {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 400px;
}

.queue-grid__items {
  display: grid;
  grid-template-columns: repeat(1, minmax(0, 1fr));
  gap: 1.5rem;
}

@media (min-width: 640px) {
  .queue-grid__items {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (min-width: 1024px) {
  .queue-grid__items {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (min-width: 1280px) {
  .queue-grid__items {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}
</style>
