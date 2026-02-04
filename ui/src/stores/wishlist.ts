import type {
  WishlistEntryWithStatus,
  WishlistFilters,
  UpdateWishlistRequest,
  ImportItem,
  ExportFormat,
  DownloadStatus,
} from '@/types/wishlist';

import { defineStore, storeToRefs } from 'pinia';
import { ref, computed, watch } from 'vue';

import * as wishlistApi from '@/services/wishlist';
import { useToast } from '@/composables/useToast';
import { useSettingsStore } from '@/stores/settings';

/**
 * Wishlist Store
 *
 * Error Handling Convention:
 * - Mutations (update, delete, etc.): Set error state, show toast, AND re-throw
 *   to allow component-level handling of side effects (e.g., closing dialogs)
 * - Fetch operations: Set error state only, don't re-throw, to allow graceful degradation
 */
export const useWishlistStore = defineStore('wishlist', () => {
  const { showSuccess, showError } = useToast();
  const settingsStore = useSettingsStore();
  const { uiPreferences } = storeToRefs(settingsStore);

  // State
  const items = ref<WishlistEntryWithStatus[]>([]);
  const total = ref(0);
  const loading = ref(false);
  const error = ref<string | null>(null);
  const processingIds = ref<Set<string>>(new Set());
  const selectedIds = ref<Set<string>>(new Set());

  const filters = ref<WishlistFilters>({
    processed: 'all',
    sort:      'addedAt_desc',
    limit:     uiPreferences.value.itemsPerPage,
    offset:    0,
  });

  // Update limit when itemsPerPage preference changes
  watch(
    () => uiPreferences.value.itemsPerPage,
    (newLimit) => {
      filters.value.limit = newLimit;
    }
  );

  // Computed
  const hasMore = computed(() => items.value.length < total.value);
  const selectedCount = computed(() => selectedIds.value.size);
  const allSelected = computed(() =>
    items.value.length > 0 && items.value.every((item) => selectedIds.value.has(item.id))
  );
  const someSelected = computed(() => selectedIds.value.size > 0 && !allSelected.value);

  // Selection helpers
  function isSelected(id: string): boolean {
    return selectedIds.value.has(id);
  }

  function toggleSelection(id: string): void {
    if (selectedIds.value.has(id)) {
      selectedIds.value.delete(id);
    } else {
      selectedIds.value.add(id);
    }
  }

  function selectAll(): void {
    items.value.forEach((item) => selectedIds.value.add(item.id));
  }

  function clearSelection(): void {
    selectedIds.value.clear();
  }

  function toggleSelectAll(): void {
    if (allSelected.value) {
      clearSelection();
    } else {
      selectAll();
    }
  }

  // Processing helpers
  function isProcessing(id: string): boolean {
    return processingIds.value.has(id);
  }

  // Fetch operations
  async function fetchWishlist(append = false) {
    loading.value = true;
    error.value = null;

    try {
      const response = await wishlistApi.getWishlistPaginated(filters.value);

      if (append) {
        items.value = [...items.value, ...response.entries];
      } else {
        items.value = response.entries;
        // Clear selection when filters change (non-append fetch)
        clearSelection();
      }

      total.value = response.total;
    } catch(e) {
      error.value = e instanceof Error ? e.message : 'Failed to fetch wishlist';
    } finally {
      loading.value = false;
    }
  }

  // Update single item
  async function updateItem(id: string, data: UpdateWishlistRequest) {
    error.value = null;
    processingIds.value.add(id);

    try {
      const response = await wishlistApi.updateWishlistItem(id, data);

      // Update the item in place
      const index = items.value.findIndex((item) => item.id === id);

      const existingItem = items.value[index];

      if (index !== -1 && existingItem) {
        // Merge updated entry while preserving download status fields
        items.value[index] = {
          ...existingItem,
          ...response.entry,
          // Preserve existing download status unless explicitly reset
          downloadStatus:  data.resetDownloadState ? 'none' : existingItem.downloadStatus,
          downloadTaskId: data.resetDownloadState ? null : existingItem.downloadTaskId,
          downloadError:  data.resetDownloadState ? null : existingItem.downloadError,
        };
      }

      showSuccess(response.message);
    } catch(e) {
      error.value = e instanceof Error ? e.message : 'Failed to update item';
      showError('Failed to update wishlist item');
      throw e;
    } finally {
      processingIds.value.delete(id);
    }
  }

  // Delete single item
  async function deleteItem(id: string) {
    error.value = null;
    processingIds.value.add(id);

    try {
      await wishlistApi.deleteFromWishlist(id);

      // Remove from list
      items.value = items.value.filter((item) => item.id !== id);
      total.value = Math.max(0, total.value - 1);

      // Remove from selection if selected
      selectedIds.value.delete(id);

      showSuccess('Removed from wishlist');
    } catch(e) {
      error.value = e instanceof Error ? e.message : 'Failed to delete item';
      showError('Failed to remove from wishlist');
      throw e;
    } finally {
      processingIds.value.delete(id);
    }
  }

  // Bulk delete
  async function bulkDelete(ids?: string[]) {
    const targetIds = ids || Array.from(selectedIds.value);

    if (targetIds.length === 0) {
      return;
    }

    error.value = null;
    targetIds.forEach((id) => processingIds.value.add(id));

    try {
      const response = await wishlistApi.bulkDeleteWishlist(targetIds);

      // Remove from list
      items.value = items.value.filter((item) => !targetIds.includes(item.id));
      total.value = Math.max(0, total.value - response.affected);

      // Clear selection for deleted items
      targetIds.forEach((id) => selectedIds.value.delete(id));

      showSuccess(response.message);
    } catch(e) {
      error.value = e instanceof Error ? e.message : 'Failed to bulk delete';
      showError('Failed to delete items');
      throw e;
    } finally {
      targetIds.forEach((id) => processingIds.value.delete(id));
    }
  }

  // Bulk requeue
  async function bulkRequeue(ids?: string[]) {
    const targetIds = ids || Array.from(selectedIds.value);

    if (targetIds.length === 0) {
      return;
    }

    error.value = null;
    targetIds.forEach((id) => processingIds.value.add(id));

    try {
      const response = await wishlistApi.bulkRequeueWishlist(targetIds);

      // Update items in place to show they're re-queued
      items.value = items.value.map((item) => {
        if (targetIds.includes(item.id)) {
          return {
            ...item,
            processedAt:    null,
            downloadStatus: 'none' as const,
            downloadTaskId: null,
            downloadError:  null,
          };
        }

        return item;
      });

      showSuccess(response.message);
    } catch(e) {
      error.value = e instanceof Error ? e.message : 'Failed to requeue';
      showError('Failed to requeue items');
      throw e;
    } finally {
      targetIds.forEach((id) => processingIds.value.delete(id));
    }
  }

  // Export
  async function exportItems(format: ExportFormat, ids?: string[]) {
    try {
      const blob = await wishlistApi.exportWishlist(format, ids);

      wishlistApi.downloadExportFile(blob, format);
      showSuccess(`Exported wishlist as ${ format.toUpperCase() }`);
    } catch(e) {
      error.value = e instanceof Error ? e.message : 'Failed to export';
      showError('Failed to export wishlist');
      throw e;
    }
  }

  // Import
  async function importItems(importedItems: ImportItem[]) {
    try {
      const response = await wishlistApi.importWishlist(importedItems);

      if (response.added > 0) {
        // Refresh the list to show new items
        await fetchWishlist();
      }

      if (response.errors > 0) {
        showError(`Import completed with ${ response.errors } error(s)`);
      } else {
        showSuccess(response.message);
      }

      return response;
    } catch(e) {
      error.value = e instanceof Error ? e.message : 'Failed to import';
      showError('Failed to import wishlist');
      throw e;
    }
  }

  // Socket event handler
  function updateItemDownloadStatus(taskId: string, status: DownloadStatus, errorMessage?: string) {
    const item = items.value.find((i) => i.downloadTaskId === taskId);

    if (item) {
      item.downloadStatus = status;

      if (errorMessage) {
        item.downloadError = errorMessage;
      }
    }
  }

  // Filter management
  function setFilters(newFilters: Partial<WishlistFilters>) {
    filters.value = {
      ...filters.value,
      ...newFilters,
      offset: 0, // Reset offset when filters change
    };
  }

  function loadMore() {
    filters.value.offset = (filters.value.offset || 0) + (filters.value.limit || 50);

    return fetchWishlist(true);
  }

  function reset() {
    items.value = [];
    total.value = 0;
    filters.value.offset = 0;
    clearSelection();
  }

  return {
    items,
    total,
    loading,
    error,
    filters,
    selectedIds,

    hasMore,
    selectedCount,
    allSelected,
    someSelected,

    isSelected,
    toggleSelection,
    selectAll,
    clearSelection,
    toggleSelectAll,

    isProcessing,

    fetchWishlist,
    updateItem,
    deleteItem,
    bulkDelete,
    bulkRequeue,
    exportItems,
    importItems,
    setFilters,
    loadMore,
    reset,

    updateItemDownloadStatus,
  };
});
