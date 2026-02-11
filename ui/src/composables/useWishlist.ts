import type { WishlistFilters, UpdateWishlistRequest, ImportItem, ExportFormat } from '@/types';

import { computed } from 'vue';

import { useWishlistStore } from '@/stores/wishlist';

export function useWishlist() {
  const store = useWishlistStore();

  // State (computed refs for reactivity)
  const items = computed(() => store.items);
  const total = computed(() => store.total);
  const loading = computed(() => store.loading);
  const error = computed(() => store.error);
  const filters = computed(() => store.filters);
  const selectedIds = computed(() => store.selectedIds);

  // Computed
  const hasMore = computed(() => store.hasMore);
  const selectedCount = computed(() => store.selectedCount);
  const allSelected = computed(() => store.allSelected);
  const someSelected = computed(() => store.someSelected);

  // Fetch operations
  async function fetchWishlist(append = false) {
    return store.fetchWishlist(append);
  }

  // Single item operations
  async function updateItem(id: string, data: UpdateWishlistRequest) {
    return store.updateItem(id, data);
  }

  async function deleteItem(id: string) {
    return store.deleteItem(id);
  }

  // Bulk operations
  async function bulkDelete(ids?: string[]) {
    return store.bulkDelete(ids);
  }

  async function bulkRequeue(ids?: string[]) {
    return store.bulkRequeue(ids);
  }

  // Export/Import
  async function exportItems(format: ExportFormat, ids?: string[]) {
    return store.exportItems(format, ids);
  }

  async function importItems(importedItems: ImportItem[]) {
    return store.importItems(importedItems);
  }

  // Selection helpers
  function isSelected(id: string) {
    return store.isSelected(id);
  }

  function toggleSelection(id: string) {
    store.toggleSelection(id);
  }

  function selectAll() {
    store.selectAll();
  }

  function clearSelection() {
    store.clearSelection();
  }

  function toggleSelectAll() {
    store.toggleSelectAll();
  }

  // Processing state
  function isProcessing(id: string) {
    return store.isProcessing(id);
  }

  // Filter management
  function updateFilters(newFilters: Partial<WishlistFilters>) {
    store.setFilters(newFilters);
  }

  function loadMore() {
    return store.loadMore();
  }

  function reset() {
    store.reset();
  }

  return {
    // State
    items,
    total,
    loading,
    error,
    filters,
    selectedIds,

    // Computed
    hasMore,
    selectedCount,
    allSelected,
    someSelected,

    // Selection
    isSelected,
    toggleSelection,
    selectAll,
    clearSelection,
    toggleSelectAll,

    // Processing
    isProcessing,

    // Operations
    fetchWishlist,
    updateItem,
    deleteItem,
    bulkDelete,
    bulkRequeue,
    exportItems,
    importItems,
    updateFilters,
    loadMore,
    reset,
  };
}
