import type { QueueFilters } from '@/types';

import { computed } from 'vue';
import { useQueueStore } from '@/stores/queue';

export function useQueue() {
  const store = useQueueStore();

  const items = computed(() => store.items);
  const total = computed(() => store.total);
  const loading = computed(() => store.loading);
  const error = computed(() => store.error);
  const filters = computed(() => store.filters);
  const hasMore = computed(() => store.hasMore);
  const availableGenres = computed(() => store.availableGenres);

  async function fetchPending(append = false) {
    return store.fetchPending(append);
  }

  async function fetchGenres() {
    return store.fetchGenres();
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
    availableGenres,
    isProcessing,
    fetchPending,
    fetchGenres,
    approveItems,
    rejectItems,
    updateFilters,
    loadMore,
    reset,
  };
}
