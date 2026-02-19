import { computed } from 'vue';

import { useActivityStore } from '@/stores/activity';

const PAGE_SIZE = 50;

export function useActivity() {
  const store = useActivityStore();

  const recentItems = computed(() => store.recentItems);
  const loading     = computed(() => store.loading);
  const error       = computed(() => store.error);

  async function fetchRecent(limit = 10) {
    return store.fetchRecent(limit);
  }

  const paginatedItems   = computed(() => store.paginatedItems);
  const total            = computed(() => store.total);
  const currentOffset    = computed(() => store.currentOffset);
  const currentPage      = computed(() => store.currentPage);
  const totalPages       = computed(() => store.totalPages);
  const hasNextPage      = computed(() => store.hasNextPage);
  const hasPrevPage      = computed(() => store.hasPrevPage);
  const paginatedLoading = computed(() => store.paginatedLoading);

  async function fetchPage(offset = 0) {
    return store.fetchPage({ limit: PAGE_SIZE, offset });
  }

  function nextPage() {
    return fetchPage(store.currentOffset + PAGE_SIZE);
  }

  function prevPage() {
    return fetchPage(Math.max(0, store.currentOffset - PAGE_SIZE));
  }

  function resetPaginated() {
    store.resetPaginated();
  }

  return {
    recentItems,
    loading,
    error,
    fetchRecent,
    paginatedItems,
    total,
    currentOffset,
    currentPage,
    totalPages,
    hasNextPage,
    hasPrevPage,
    paginatedLoading,
    fetchPage,
    nextPage,
    prevPage,
    resetPaginated,
  };
}
