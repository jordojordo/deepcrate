import type { ActivityItem } from '@/types';

import { defineStore } from 'pinia';
import { computed, ref } from 'vue';

import * as activityApi from '@/services/activity';

const MAX_ITEMS   = 20;
const PAGE_SIZE   = 50;

export const useActivityStore = defineStore('activity', () => {
  const recentItems = ref<ActivityItem[]>([]);
  const loading     = ref(false);
  const error       = ref<string | null>(null);

  const paginatedItems   = ref<ActivityItem[]>([]);
  const total            = ref(0);
  const currentOffset    = ref(0);
  const paginatedLoading = ref(false);
  const paginatedError   = ref<string | null>(null);

  const currentPage = computed(() => Math.floor(currentOffset.value / PAGE_SIZE) + 1);
  const totalPages  = computed(() => Math.max(1, Math.ceil(total.value / PAGE_SIZE)));
  const hasNextPage = computed(() => currentOffset.value + PAGE_SIZE < total.value);
  const hasPrevPage = computed(() => currentOffset.value > 0);

  async function fetchRecent(limit = 10) {
    loading.value = true;
    error.value = null;

    try {
      recentItems.value = await activityApi.getRecent(limit);
    } catch(e) {
      error.value = e instanceof Error ? e.message : 'Failed to fetch activity';
    } finally {
      loading.value = false;
    }
  }

  function addItem(item: ActivityItem) {
    recentItems.value.unshift(item);

    if (recentItems.value.length > MAX_ITEMS) {
      recentItems.value = recentItems.value.slice(0, MAX_ITEMS);
    }
  }

  async function fetchPage(params: { limit: number; offset: number }) {
    paginatedLoading.value = true;
    paginatedError.value = null;

    try {
      const result = await activityApi.getPaginated(params);

      paginatedItems.value = result.items;
      total.value          = result.total;
      currentOffset.value  = params.offset;
    } catch(e) {
      paginatedError.value = e instanceof Error ? e.message : 'Failed to fetch activity';
    } finally {
      paginatedLoading.value = false;
    }
  }

  function resetPaginated() {
    paginatedItems.value   = [];
    total.value            = 0;
    currentOffset.value    = 0;
    paginatedLoading.value = false;
    paginatedError.value   = null;
  }

  return {
    recentItems,
    loading,
    error,
    fetchRecent,
    addItem,
    paginatedItems,
    total,
    currentOffset,
    paginatedLoading,
    paginatedError,
    currentPage,
    totalPages,
    hasNextPage,
    hasPrevPage,
    fetchPage,
    resetPaginated,
  };
});
