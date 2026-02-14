<script setup lang="ts">
import type { NavigationDirection, QueueItem, ViewMode } from '@/types';

import {
  onMounted, onUnmounted, ref, watch, computed
} from 'vue';
import { useQueue } from '@/composables/useQueue';
import { useQueueSocket } from '@/composables/useQueueSocket';
import { useToast } from '@/composables/useToast';
import { useKeyboardShortcuts } from '@/composables/useKeyboardShortcuts';
import { usePlayer } from '@/composables/usePlayer';
import { useSettings } from '@/composables/useSettings';

import Button from 'primevue/button';
import QueueFilters from '@/components/queue/QueueFilters.vue';
import QueueList from '@/components/queue/QueueList.vue';
import QueueGrid from '@/components/queue/QueueGrid.vue';
import KeyboardShortcutsHelp from '@/components/common/KeyboardShortcutsHelp.vue';
import ErrorMessage from '@/components/common/ErrorMessage.vue';
import LibrarySyncInfo from '@/components/queue/LibrarySyncInfo.vue';

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

const { showWarning } = useToast();
const { playQueueItem, currentTrack, togglePlay } = usePlayer();
const { uiPreferences } = useSettings();

const viewMode = ref<ViewMode>(uiPreferences.value.queueViewMode);
const focusIndex = ref(-1);
const gridColumns = ref(1);
const gridContainerRef = ref<HTMLElement | null>(null);

watch(viewMode, () => {
  focusIndex.value = items.value.length > 0 ? 0 : -1;
});

const focusedItem = computed(() => {
  if (focusIndex.value < 0) {
    return null;
  }

  return items.value[focusIndex.value] || null;
});

function handleNavigate(direction: NavigationDirection) {
  if (items.value.length === 0) {
    return;
  }

  if (focusIndex.value < 0) {
    focusIndex.value = 0;

    return;
  }

  const cols = viewMode.value === 'grid' ? gridColumns.value : 0;
  const offsets: Record<NavigationDirection, number> = {
    left:  cols ? -1 : 0,
    right: cols ? 1 : 0,
    up:    cols ? -cols : -1,
    down:  cols ? cols : 1,
  };

  const offset = offsets[direction];
  const newIndex = focusIndex.value + offset;

  focusIndex.value = Math.max(0, Math.min(items.value.length - 1, newIndex));
}


function handleTogglePreview() {
  if (!focusedItem.value) {
    return;
  }

  // If this item is already playing, toggle play/pause
  if (currentTrack.value?.id === focusedItem.value.mbid) {
    togglePlay();
  } else {
    playQueueItem(focusedItem.value);
  }
}

function handleClearFocus() {
  focusIndex.value = -1;
}

function updateFocusIndex(index: number) {
  focusIndex.value = index;
}

const { isHelpOpen, closeHelp, shortcuts } = useKeyboardShortcuts({
  onApprove: () => {
    if (focusedItem.value) {
      handleApprove([focusedItem.value.mbid]);
    } else {
      showWarning('No item focused', 'Use arrow keys to focus an item first');
    }
  },
  onReject: () => {
    if (focusedItem.value) {
      handleReject([focusedItem.value.mbid]);
    } else {
      showWarning('No item focused', 'Use arrow keys to focus an item first');
    }
  },
  onNavigate:      handleNavigate,
  onTogglePreview: handleTogglePreview,
  onClearFocus:    handleClearFocus,
  onResearch:      () => {
    if (focusedItem.value) {
      window.open(`https://musicbrainz.org/release-group/${ focusedItem.value.mbid }`, '_blank', 'noopener');
    } else {
      showWarning('No item focused', 'Use arrow keys to focus an item first');
    }
  },
});

let resizeObserver: ResizeObserver | null = null;

function updateGridColumns() {
  if (viewMode.value !== 'grid') {
    return;
  }

  // Use viewport width to match CSS media query breakpoints
  const width = window.innerWidth;

  // Match breakpoints from QueueGrid.vue CSS
  if (width >= 1280) {
    gridColumns.value = 4;
  } else if (width >= 1024) {
    gridColumns.value = 3;
  } else if (width >= 520) {
    gridColumns.value = 2;
  } else {
    gridColumns.value = 1;
  }
}

function setGridContainerRef(el: HTMLElement | null) {
  if (el === gridContainerRef.value) {
    return;
  }

  if (resizeObserver) {
    resizeObserver.disconnect();
    resizeObserver = null;
  }

  gridContainerRef.value = el;

  if (el) {
    resizeObserver = new ResizeObserver(updateGridColumns);
    resizeObserver.observe(el);
    updateGridColumns();
  }
}

onMounted(() => {
  fetchPending();
});

onUnmounted(() => {
  if (resizeObserver) {
    resizeObserver.disconnect();
    resizeObserver = null;
  }
});

watch(
  () => [filters.value.source, filters.value.sort, filters.value.order],
  () => {
    reset();
    fetchPending();
  }
);

watch(
  () => items.value.length,
  (newLength) => {
    if (focusIndex.value >= newLength) {
      focusIndex.value = Math.max(-1, newLength - 1);
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
  playQueueItem(item);
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
        <LibrarySyncInfo />
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
        :focus-index="focusIndex"
        @approve="handleApprove"
        @reject="handleReject"
        @preview="handlePreview"
        @update:focus-index="updateFocusIndex"
        @container-ref="setGridContainerRef"
      />

      <QueueList
        v-else
        :items="items"
        :loading="loading"
        :focus-index="focusIndex"
        @approve="handleApprove"
        @reject="handleReject"
        @preview="handlePreview"
        @update:focus-index="updateFocusIndex"
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

<style lang="scss" scoped>
.queue-page {
  max-width: 1200px;
  margin: 0 auto;

  &__header {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    margin-bottom: 2rem;

    @media (min-width: 768px) {
      flex-direction: row;
      align-items: flex-end;
      justify-content: space-between;
    }
  }

  &__title {
    font-size: 1.875rem;
    font-weight: 700;
    color: var(--r-text-primary);
    line-height: 1.2;
    margin: 0;

    @media (min-width: 768px) {
      font-size: 2.25rem;
    }
  }

  &__count {
    font-weight: 400;
    color: var(--surface-300);
    margin-left: 0.5rem;
    font-size: 1.5rem;
  }

  &__subtitle {
    font-size: 0.875rem;
    color: var(--surface-300);
    margin: 0.5rem 0 0 0;
    max-width: 40rem;
    line-height: 1.6;

    @media (min-width: 768px) {
      font-size: 1rem;
    }
  }

  &__subtitle-break {
    display: none;

    @media (min-width: 768px) {
      display: block;
    }
  }

  &__shortcuts {
    display: inline-block;
    font-size: 0.75rem;
    opacity: 0.6;
    margin-top: 0.5rem;

    kbd {
      background: var(--r-hover-bg);
      padding: 0.125rem 0.375rem;
      border-radius: 0.25rem;
      margin: 0 0.25rem;
      font-family: inherit;
    }
  }

  &__filters {
    margin-bottom: 1.5rem;
    padding-bottom: 1rem;
    border-bottom: 1px solid var(--r-border-default);
  }

  &__content {
    min-height: 400px;
  }

  &__load-more {
    margin-top: 2rem;
    text-align: center;
  }

  &__footer {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    margin-top: 3rem;
    padding-top: 2rem;
    border-top: 1px solid var(--r-border-default);
    color: var(--r-text-muted);
    font-size: 0.875rem;

    @media (min-width: 768px) {
      flex-direction: row;
      justify-content: space-between;
      align-items: center;
    }

    p {
      margin: 0;
    }
  }
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
