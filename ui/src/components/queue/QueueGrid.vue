<script setup lang="ts">
import type { QueueItem } from '@/types';

import { ref, watch } from 'vue';
import { useJobs } from '@/composables/useJobs';

import ProgressSpinner from 'primevue/progressspinner';
import EmptyState from '@/components/common/EmptyState.vue';
import QueueItemCard from './QueueItemCard.vue';

interface Props {
  items:         QueueItem[];
  loading?:      boolean;
  isProcessing?: (mbid: string) => boolean;
  focusIndex?:   number;
}

const { triggerListenBrainz } = useJobs();

const props = withDefaults(defineProps<Props>(), {
  loading:      false,
  isProcessing: () => false,
  focusIndex:   -1,
});

const emit = defineEmits<{
  approve:              [mbids: string[]];
  reject:               [mbids: string[]];
  preview:              [item: QueueItem];
  'update:focus-index': [index: number];
  'container-ref':      [el: HTMLElement | null];
}>();

const gridItemsRef = ref<HTMLElement | null>(null);

watch(gridItemsRef, (el) => {
  emit('container-ref', el);
}, { immediate: true });

const handleApprove = (mbid: string) => {
  emit('approve', [mbid]);
};

const handleReject = (mbid: string) => {
  emit('reject', [mbid]);
};

const handlePreview = (item: QueueItem) => {
  emit('preview', item);
};

const handleCardClick = (index: number) => {
  emit('update:focus-index', index);
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
      action-label="Discover Music"
      action-icon="pi-search"
      @action="triggerListenBrainz()"
    />

    <div v-else ref="gridItemsRef" class="queue-grid__items">
      <QueueItemCard
        v-for="(item, index) in items"
        :key="item.mbid"
        :item="item"
        :processing="props.isProcessing(item.mbid)"
        :focused="index === props.focusIndex"
        @approve="handleApprove"
        @reject="handleReject"
        @preview="handlePreview"
        @click="handleCardClick(index)"
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

@media (min-width: 520px) {
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
