import { computed } from 'vue';
import { useQueueStore } from '@/stores/queue';
import type { QueueFilters } from '@/types';

export function useQueue() {
  const store = useQueueStore();

  const items = computed(() => store.items);
  const total = computed(() => store.total);
  const loading = computed(() => store.loading);
  const error = computed(() => store.error);
  const filters = computed(() => store.filters);
  const hasMore = computed(() => store.hasMore);

  async function fetchPending(append = false) {
    return store.fetchPending(append);
  }

  async function approveItems(mbids: string[]) {
    return store.approve(mbids);
  }

  async function rejectItems(mbids: string[]) {
    return store.reject(mbids);
  }

  function updateFilters(filters: Partial<QueueFilters>) {
    store.setFilters(filters);
  }

  function loadMore() {
    return store.loadMore();
  }

  function reset() {
    store.reset();
  }

  function isProcessing(mbid: string) {
    return store.isProcessing(mbid);
  }

  return {
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
    loadMore,
    reset,
  };
}
