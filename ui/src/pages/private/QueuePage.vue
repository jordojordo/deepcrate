<script setup lang="ts">
import type { QueueItem } from '@/types';
import type { ViewMode } from '@/components/queue/QueueFilters.vue';

import { onMounted, ref, watch, computed } from 'vue';
import { useQueue } from '@/composables/useQueue';
import { useQueueSocket } from '@/composables/useQueueSocket';
import { useToast } from '@/composables/useToast';
import { useKeyboardShortcuts } from '@/composables/useKeyboardShortcuts';

import Button from 'primevue/button';
import QueueFilters from '@/components/queue/QueueFilters.vue';
import QueueList from '@/components/queue/QueueList.vue';
import QueueGrid from '@/components/queue/QueueGrid.vue';
import KeyboardShortcutsHelp from '@/components/common/KeyboardShortcutsHelp.vue';
import ErrorMessage from '@/components/common/ErrorMessage.vue';

const {
  items,
  total,
  loading,
  error,
  filters,
  hasMore,
  isProcessing,
  fetchPending,
  approveItems,
  rejectItems,
  updateFilters,
  loadMore: loadMoreItems,
  reset,
} = useQueue();

useQueueSocket();

const { showInfo, showWarning } = useToast();

const viewMode = ref<ViewMode>('grid');
const selectedIndex = ref(0);

const selectedItem = computed(() => items.value[selectedIndex.value] ?? null);

const { isHelpOpen, closeHelp, shortcuts } = useKeyboardShortcuts({
  onApprove: () => {
    if (selectedItem.value) {
      handleApprove([selectedItem.value.mbid]);
    } else {
      showWarning('No item selected', 'Select an item first to approve');
    }
  },
  onReject: () => {
    if (selectedItem.value) {
      handleReject([selectedItem.value.mbid]);
    } else {
      showWarning('No item selected', 'Select an item first to reject');
    }
  },
});

onMounted(() => {
  fetchPending();
});

watch(
  () => [filters.value.source, filters.value.sort, filters.value.order],
  () => {
    reset();
    fetchPending();
  }
);

// Reset selected index when items change
watch(
  () => items.value.length,
  () => {
    if (selectedIndex.value >= items.value.length) {
      selectedIndex.value = Math.max(0, items.value.length - 1);
    }
  }
);

async function handleApprove(mbids: string[]) {
  try {
    await approveItems(mbids);
  } catch {
    // Error is already handled in the store
  }
}

async function handleReject(mbids: string[]) {
  try {
    await rejectItems(mbids);
  } catch {
    // Error is already handled in the store
  }
}

function handlePreview(item: QueueItem) {
  // TODO: Implement preview functionality
  //       This will need to include a media player to preview songs/albums/artists
  //       Should this fetch from listenbrainz? last.fm? tbd...
  console.log('Preview item:', JSON.parse(JSON.stringify(item)));

  showInfo(
    'Preview coming soon',
    `Artist: ${ item.artist }\n Title: ${ item.title ?? item.album }`
  );
}
</script>

<template>
  <div class="queue-page">
    <header class="queue-page__header">
      <div>
        <h1 class="queue-page__title">
          Pending Queue
          <span class="queue-page__count">({{ total }})</span>
        </h1>
        <p class="queue-page__subtitle">
          Review music recommendations discovered by your automated agents.
          <br class="queue-page__subtitle-break" />
          <span class="queue-page__shortcuts">
            Press <kbd>?</kbd> for keyboard shortcuts
          </span>
        </p>
      </div>
    </header>

    <ErrorMessage
      :error="error"
      :loading="loading"
      @retry="fetchPending"
    />

    <div class="queue-page__filters">
      <QueueFilters
        :model-value="filters"
        :view-mode="viewMode"
        @update:model-value="updateFilters($event)"
        @update:view-mode="viewMode = $event"
      />
    </div>

    <div class="queue-page__content">
      <QueueGrid
        v-if="viewMode === 'grid'"
        :items="items"
        :loading="loading"
        :is-processing="isProcessing"
        @approve="handleApprove"
        @reject="handleReject"
        @preview="handlePreview"
      />

      <QueueList
        v-else
        :items="items"
        :loading="loading"
        @approve="handleApprove"
        @reject="handleReject"
      />
    </div>

    <div v-if="hasMore && !loading" class="queue-page__load-more">
      <Button
        label="Load More"
        icon="pi pi-angle-down"
        outlined
        class="queue-page__load-more-btn"
        @click="loadMoreItems"
      />
    </div>

    <div class="queue-page__footer">
      <p>{{ items.length }} albums displayed</p>
    </div>

    <KeyboardShortcutsHelp
      v-model:visible="isHelpOpen"
      :shortcuts="shortcuts"
      @update:visible="closeHelp"
    />
  </div>
</template>

<style scoped>
.queue-page {
  max-width: 1200px;
  margin: 0 auto;
}

.queue-page__header {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  margin-bottom: 2rem;
}

@media (min-width: 768px) {
  .queue-page__header {
    flex-direction: row;
    align-items: flex-end;
    justify-content: space-between;
  }
}

.queue-page__title {
  font-size: 1.875rem;
  font-weight: 700;
  color: var(--r-text-primary);
  line-height: 1.2;
  margin: 0;
}

@media (min-width: 768px) {
  .queue-page__title {
    font-size: 2.25rem;
  }
}

.queue-page__count {
  font-weight: 400;
  color: var(--surface-300);
  margin-left: 0.5rem;
  font-size: 1.5rem;
}

.queue-page__subtitle {
  font-size: 0.875rem;
  color: var(--surface-300);
  margin: 0.5rem 0 0 0;
  max-width: 40rem;
  line-height: 1.6;
}

@media (min-width: 768px) {
  .queue-page__subtitle {
    font-size: 1rem;
  }
}

.queue-page__subtitle-break {
  display: none;
}

@media (min-width: 768px) {
  .queue-page__subtitle-break {
    display: block;
  }
}

.queue-page__shortcuts {
  display: inline-block;
  font-size: 0.75rem;
  opacity: 0.6;
  margin-top: 0.5rem;
}

.queue-page__shortcuts kbd {
  background: var(--r-hover-bg);
  padding: 0.125rem 0.375rem;
  border-radius: 0.25rem;
  margin: 0 0.25rem;
  font-family: inherit;
}

.queue-page__filters {
  margin-bottom: 1.5rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid var(--r-border-default);
}

.queue-page__content {
  min-height: 400px;
}

.queue-page__load-more {
  margin-top: 2rem;
  text-align: center;
}

.queue-page__footer {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-top: 3rem;
  padding-top: 2rem;
  border-top: 1px solid var(--r-border-default);
  color: var(--r-text-muted);
  font-size: 0.875rem;
}

@media (min-width: 768px) {
  .queue-page__footer {
    flex-direction: row;
    justify-content: space-between;
    align-items: center;
  }
}

.queue-page__footer p {
  margin: 0;
}

/* Button styling */
:deep(.queue-page__bulk-btn) {
  background: var(--primary-500);
  border-color: var(--primary-500);
  font-weight: 700;
}

:deep(.queue-page__bulk-btn:hover) {
  background: var(--primary-600);
  border-color: var(--primary-600);
}

:deep(.queue-page__load-more-btn) {
  background: var(--surface-card);
  border-color: var(--r-border-default);
  color: var(--r-text-primary);
}

:deep(.queue-page__load-more-btn:hover) {
  background: var(--r-hover-bg);
  border-color: var(--r-border-emphasis);
}
</style>
