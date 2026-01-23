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
  const statsError = ref<string | null>(null);

  const loading = ref(false);
  const error = ref<string | null>(null);

  const filters = ref<DownloadFilters>({
    limit:  20,
    offset: 0,
  });

  const selectedTaskId = ref<string | null>(null);
  const selectionModalVisible = ref(false);
  const selectionLoading = ref(false);

  // Separate offset tracking for each list to avoid cross-tab pagination issues
  const completedOffset = ref(0);
  const failedOffset = ref(0);

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
      // Use separate offset for completed list when appending
      const requestFilters = append ? { ...filters.value, offset: completedOffset.value } : filters.value;

      const response = await downloadsApi.getCompleted(requestFilters);

      if (append) {
        completedDownloads.value = [...completedDownloads.value, ...response.items];
      } else {
        completedDownloads.value = response.items;
        completedOffset.value = 0;
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
      // Use separate offset for failed list when appending
      const requestFilters = append ? { ...filters.value, offset: failedOffset.value } : filters.value;

      const response = await downloadsApi.getFailed(requestFilters);

      if (append) {
        failedDownloads.value = [...failedDownloads.value, ...response.items];
      } else {
        failedDownloads.value = response.items;
        failedOffset.value = 0;
      }
      failedTotal.value = response.total;
    } catch(e) {
      error.value = e instanceof Error ? e.message : 'Failed to fetch failed downloads';
    } finally {
      loading.value = false;
    }
  }

  async function fetchStats() {
    statsError.value = null;

    try {
      stats.value = await downloadsApi.getStats();
    } catch(e) {
      // Set stats-specific error but don't block other operations
      statsError.value = 'Failed to load stats';
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

  async function deleteDownloads(ids: string[]) {
    loading.value = true;
    error.value = null;

    try {
      const result = await downloadsApi.deleteDownloads({ ids });

      // Remove deleted items from all lists (item could be in any tab)
      activeDownloads.value = activeDownloads.value.filter((d) => !ids.includes(d.id));
      activeTotal.value = Math.max(0, activeTotal.value - result.success);

      completedDownloads.value = completedDownloads.value.filter((d) => !ids.includes(d.id));
      completedTotal.value = Math.max(0, completedTotal.value - result.success);

      failedDownloads.value = failedDownloads.value.filter((d) => !ids.includes(d.id));
      failedTotal.value = Math.max(0, failedTotal.value - result.success);

      showSuccess('Downloads deleted', `${ result.success } download(s) removed`);

      // Refresh stats
      await fetchStats();
    } catch(e) {
      error.value = e instanceof Error ? e.message : 'Failed to delete downloads';
      showError('Failed to delete downloads');
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
    completedOffset.value += filters.value.limit;

    return fetchCompleted(true);
  }

  function loadMoreFailed() {
    failedOffset.value += filters.value.limit;

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
    statsError.value = null;
    filters.value.offset = 0;
    completedOffset.value = 0;
    failedOffset.value = 0;
    selectedTaskId.value = null;
    selectionModalVisible.value = false;
  }

  function openSelectionModal(taskId: string) {
    selectedTaskId.value = taskId;
    selectionModalVisible.value = true;
  }

  function closeSelectionModal() {
    selectedTaskId.value = null;
    selectionModalVisible.value = false;
  }

  async function selectResult(taskId: string, username: string, directory?: string) {
    selectionLoading.value = true;

    try {
      await downloadsApi.selectResult(taskId, username, directory);
      showSuccess('Download queued', `Selected source: ${ username }`);
      closeSelectionModal();

      await Promise.all([fetchActive(), fetchStats()]);
    } catch(e) {
      showError('Failed to select source');
      throw e;
    } finally {
      selectionLoading.value = false;
    }
  }

  /**
   * Skip a search result source.
   * Note: Unlike other selection methods, this doesn't use selectionLoading state
   * because the component performs optimistic local UI updates before calling this
   * method (removing the result from the list immediately for better UX).
   */
  async function skipResult(taskId: string, username: string) {
    try {
      await downloadsApi.skipResult(taskId, username);
    } catch(e) {
      showError('Failed to skip source');
      throw e;
    }
  }

  async function retrySearchForTask(taskId: string, query?: string) {
    selectionLoading.value = true;

    try {
      await downloadsApi.retrySearch(taskId, query);
      showSuccess('Search started', 'Searching for new results...');
      closeSelectionModal();

      await fetchActive();
    } catch(e) {
      showError('Failed to start search');
      throw e;
    } finally {
      selectionLoading.value = false;
    }
  }

  async function autoSelectForTask(taskId: string) {
    selectionLoading.value = true;

    try {
      await downloadsApi.autoSelect(taskId);
      showSuccess('Download queued', 'Auto-selected best source');
      closeSelectionModal();

      await Promise.all([fetchActive(), fetchStats()]);
    } catch(e) {
      showError('Failed to auto-select');
      throw e;
    } finally {
      selectionLoading.value = false;
    }
  }

  return {
    activeDownloads,
    activeTotal,
    completedDownloads,
    completedTotal,
    failedDownloads,
    failedTotal,
    stats,
    statsError,
    loading,
    error,
    filters,

    selectedTaskId,
    selectionModalVisible,
    selectionLoading,

    hasMoreCompleted,
    hasMoreFailed,

    fetchActive,
    fetchCompleted,
    fetchFailed,
    fetchStats,
    retryFailed,
    deleteDownloads,
    setFilters,
    loadMoreCompleted,
    loadMoreFailed,
    reset,

    openSelectionModal,
    closeSelectionModal,
    selectResult,
    skipResult,
    retrySearchForTask,
    autoSelectForTask,
  };
});
