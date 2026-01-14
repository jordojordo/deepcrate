import type {
  ActiveDownload,
  CompletedDownload,
  FailedDownload,
  DownloadStats,
  DownloadFilters,
} from '@/types';

import { defineStore } from 'pinia';
import { ref, computed } from 'vue';

import * as downloadsApi from '@/services/downloads';
import { useToast } from '@/composables/useToast';

export const useDownloadsStore = defineStore('downloads', () => {
  const { showSuccess, showError } = useToast();

  const activeDownloads = ref<ActiveDownload[]>([]);
  const activeTotal = ref(0);

  const completedDownloads = ref<CompletedDownload[]>([]);
  const completedTotal = ref(0);

  const failedDownloads = ref<FailedDownload[]>([]);
  const failedTotal = ref(0);

  const stats = ref<DownloadStats | null>(null);

  const loading = ref(false);
  const error = ref<string | null>(null);

  const filters = ref<DownloadFilters>({
    limit:  20,
    offset: 0,
  });

  const hasMoreCompleted = computed(() => completedDownloads.value?.length < completedTotal.value);
  const hasMoreFailed = computed(() => failedDownloads.value?.length < failedTotal.value);

  async function fetchActive() {
    loading.value = true;
    error.value = null;

    try {
      const response = await downloadsApi.getActive(filters.value);

      activeDownloads.value = response.items;
      activeTotal.value = response.total;
    } catch(e) {
      error.value = e instanceof Error ? e.message : 'Failed to fetch active downloads';
    } finally {
      loading.value = false;
    }
  }

  async function fetchCompleted(append = false) {
    loading.value = true;
    error.value = null;

    try {
      const response = await downloadsApi.getCompleted(filters.value);

      if (append) {
        completedDownloads.value = [...completedDownloads.value, ...response.items];
      } else {
        completedDownloads.value = response.items;
      }
      completedTotal.value = response.total;
    } catch(e) {
      error.value = e instanceof Error ? e.message : 'Failed to fetch completed downloads';
    } finally {
      loading.value = false;
    }
  }

  async function fetchFailed(append = false) {
    loading.value = true;
    error.value = null;

    try {
      const response = await downloadsApi.getFailed(filters.value);

      if (append) {
        failedDownloads.value = [...failedDownloads.value, ...response.items];
      } else {
        failedDownloads.value = response.items;
      }
      failedTotal.value = response.total;
    } catch(e) {
      error.value = e instanceof Error ? e.message : 'Failed to fetch failed downloads';
    } finally {
      loading.value = false;
    }
  }

  async function fetchStats() {
    try {
      stats.value = await downloadsApi.getStats();
    } catch(e) {
      // Don't set loading or error for stats - it's a background operation
      console.error('Failed to fetch download stats:', e);
    }
  }

  async function retryFailed(ids: string[]) {
    loading.value = true;
    error.value = null;

    try {
      const result = await downloadsApi.retry({ ids });

      // Remove retried items from the failed list
      failedDownloads.value = failedDownloads.value.filter((download) => !ids.includes(download.id));
      failedTotal.value = Math.max(0, failedTotal.value - result.success);

      showSuccess('Downloads retried', `${ result.success } download(s) queued for retry`);

      // Refresh stats
      await fetchStats();
    } catch(e) {
      error.value = e instanceof Error ? e.message : 'Failed to retry downloads';
      showError('Failed to retry downloads');
      throw e;
    } finally {
      loading.value = false;
    }
  }

  function setFilters(newFilters: Partial<DownloadFilters>) {
    filters.value = {
      ...filters.value,
      ...newFilters,
      offset: 0,
    };
  }

  function loadMoreCompleted() {
    filters.value.offset += filters.value.limit;

    return fetchCompleted(true);
  }

  function loadMoreFailed() {
    filters.value.offset += filters.value.limit;

    return fetchFailed(true);
  }

  function reset() {
    activeDownloads.value = [];
    activeTotal.value = 0;
    completedDownloads.value = [];
    completedTotal.value = 0;
    failedDownloads.value = [];
    failedTotal.value = 0;
    stats.value = null;
    filters.value.offset = 0;
  }

  return {
    activeDownloads,
    activeTotal,
    completedDownloads,
    completedTotal,
    failedDownloads,
    failedTotal,
    stats,
    loading,
    error,
    filters,

    hasMoreCompleted,
    hasMoreFailed,

    fetchActive,
    fetchCompleted,
    fetchFailed,
    fetchStats,
    retryFailed,
    setFilters,
    loadMoreCompleted,
    loadMoreFailed,
    reset,
  };
});
