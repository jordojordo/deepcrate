<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';
import { useQueue } from '@/composables/useQueue';

import Message from 'primevue/message';
import Button from 'primevue/button';
import QueueFilters, { type ViewMode } from '@/components/queue/QueueFilters.vue';
import QueueList from '@/components/queue/QueueList.vue';
import QueueGrid from '@/components/queue/QueueGrid.vue';

const {
  items,
  total,
  loading,
  error,
  filters,
  hasMore,
  fetchPending,
  approveItems,
  rejectItems,
  updateFilters,
  loadMore: loadMoreItems,
  reset,
} = useQueue();

// View mode state (grid or list)
const viewMode = ref<ViewMode>('grid');

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

function handlePreview(item: unknown) {
  // TODO: Implement preview functionality
  console.log('Preview item:', item);
}
</script>

<template>
  <div class="queue-page">
    <!-- Page Header -->
    <header class="queue-page__header">
      <div>
        <h1 class="queue-page__title">
          Pending Queue
          <span class="queue-page__count">({{ total }})</span>
        </h1>
        <p class="queue-page__subtitle">
          Review music recommendations discovered by your automated agents.
          <br class="hidden md:block" />
          <span class="queue-page__shortcuts">
            Keyboard Shortcuts:
            <kbd>A</kbd> Approve
            <kbd>D</kbd> Dismiss
          </span>
        </p>
      </div>
      <div class="flex align-items-center gap-3">
        <Button
          label="Approve High Confidence"
          icon="pi pi-check-square"
          class="queue-page__bulk-btn"
        />
      </div>
    </header>

    <!-- Error Message -->
    <Message v-if="error" severity="error" class="mb-6" :closable="false">
      {{ error }}
    </Message>

    <!-- Filters -->
    <div class="queue-page__filters">
      <QueueFilters
        :model-value="filters"
        :view-mode="viewMode"
        @update:model-value="updateFilters($event)"
        @update:view-mode="viewMode = $event"
      />
    </div>

    <!-- Queue Content -->
    <div class="queue-page__content">
      <!-- Grid View -->
      <QueueGrid
        v-if="viewMode === 'grid'"
        :items="items"
        :loading="loading"
        @approve="handleApprove"
        @reject="handleReject"
        @preview="handlePreview"
      />

      <!-- List View -->
      <QueueList
        v-else
        :items="items"
        :loading="loading"
        @approve="handleApprove"
        @reject="handleReject"
      />
    </div>

    <!-- Load More Button -->
    <div v-if="hasMore && !loading" class="queue-page__load-more">
      <Button
        label="Load More"
        icon="pi pi-angle-down"
        outlined
        class="queue-page__load-more-btn"
        @click="loadMoreItems"
      />
    </div>

    <!-- Footer info -->
    <div class="queue-page__footer">
      <p>Resonance v2.4.0 &bull; Connected to discovery sources</p>
      <p>{{ items.length }} albums displayed</p>
    </div>
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
  color: white;
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

.queue-page__shortcuts {
  display: inline-block;
  font-size: 0.75rem;
  opacity: 0.6;
  margin-top: 0.5rem;
}

.queue-page__shortcuts kbd {
  background: var(--surface-600);
  padding: 0.125rem 0.375rem;
  border-radius: 0.25rem;
  margin: 0 0.25rem;
  font-family: inherit;
}

.queue-page__filters {
  margin-bottom: 1.5rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid var(--surface-600);
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
  border-top: 1px solid var(--surface-600);
  color: var(--surface-400);
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
  background: var(--surface-700);
  border-color: var(--surface-600);
  color: white;
}

:deep(.queue-page__load-more-btn:hover) {
  background: var(--surface-600);
  border-color: var(--surface-500);
}
</style>
