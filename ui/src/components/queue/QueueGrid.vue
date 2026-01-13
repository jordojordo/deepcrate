<script setup lang="ts">
import type { QueueItem } from '@/types/queue';
import QueueItemCard from './QueueItemCard.vue';
import ProgressSpinner from 'primevue/progressspinner';

interface Props {
  items:    QueueItem[];
  loading?: boolean;
}

withDefaults(defineProps<Props>(), { loading: false });

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
    <!-- Loading State -->
    <div v-if="loading" class="queue-grid__loading">
      <ProgressSpinner style="width: 48px; height: 48px" />
    </div>

    <!-- Empty State -->
    <div v-else-if="items.length === 0" class="queue-grid__empty">
      <i class="pi pi-inbox queue-grid__empty-icon"></i>
      <p class="queue-grid__empty-title">No pending items</p>
      <p class="queue-grid__empty-text">
        New music recommendations will appear here when discovered
      </p>
    </div>

    <!-- Grid -->
    <div v-else class="queue-grid__items">
      <QueueItemCard
        v-for="item in items"
        :key="item.mbid"
        :item="item"
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
}

.queue-grid__loading {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 400px;
}

.queue-grid__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 4rem 2rem;
  text-align: center;
}

.queue-grid__empty-icon {
  font-size: 4rem;
  color: var(--surface-500);
  margin-bottom: 1rem;
}

.queue-grid__empty-title {
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--surface-300);
  margin: 0 0 0.5rem 0;
}

.queue-grid__empty-text {
  font-size: 0.875rem;
  color: var(--surface-400);
  margin: 0;
  max-width: 300px;
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
