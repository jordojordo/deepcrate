<script setup lang="ts">
import type { WishlistEntryWithStatus, UpdateWishlistRequest, ImportItem, ViewMode } from '@/types';

import { onMounted, ref, watch } from 'vue';
import { useWishlist } from '@/composables/useWishlist';
import { useWishlistSocket } from '@/composables/useWishlistSocket';
import { useSettings } from '@/composables/useSettings';

import Button from 'primevue/button';
import Menu from 'primevue/menu';
import WishlistFilters from '@/components/wishlist/WishlistFilters.vue';
import WishlistGrid from '@/components/wishlist/WishlistGrid.vue';
import WishlistList from '@/components/wishlist/WishlistList.vue';
import EditWishlistModal from '@/components/wishlist/EditWishlistModal.vue';
import ImportWishlistModal from '@/components/wishlist/ImportWishlistModal.vue';
import ErrorMessage from '@/components/common/ErrorMessage.vue';

const {
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
  isProcessing,
  fetchWishlist,
  updateItem,
  deleteItem,
  bulkDelete,
  bulkRequeue,
  exportItems,
  importItems,
  updateFilters,
  loadMore: loadMoreItems,
  reset,
} = useWishlist();

// Connect to downloads socket for real-time status updates
useWishlistSocket();

const { uiPreferences } = useSettings();

const viewMode = ref<ViewMode>(uiPreferences.value.wishlistViewMode || 'grid');

const editModalVisible = ref(false);
const editingItem = ref<WishlistEntryWithStatus | null>(null);
const importModalVisible = ref(false);

const exportMenu = ref();
const exportMenuItems = ref([
  {
    label:   'Export All',
    icon:    'pi pi-file',
    command: handleExport,
  },
  {
    label:    'Export Selected',
    icon:     'pi pi-check-square',
    command:  handleExportSelected,
    disabled: () => selectedCount.value === 0,
  },
]);

onMounted(() => {
  fetchWishlist();
});

watch(
  () => [
    filters.value.source,
    filters.value.type,
    filters.value.processed,
    filters.value.sort,
  ],
  () => {
    reset();
    fetchWishlist();
  }
);

watch(viewMode, (newMode) => {
  uiPreferences.value.wishlistViewMode = newMode;
});

function handleSelect(id: string) {
  toggleSelection(id);
}

function handleEdit(item: WishlistEntryWithStatus) {
  editingItem.value = item;
  editModalVisible.value = true;
}

async function handleSaveEdit(id: string, data: UpdateWishlistRequest) {
  try {
    await updateItem(id, data);
  } catch {
    // Error handled in store
  }
}

async function handleDelete(id: string) {
  try {
    await deleteItem(id);
  } catch {
    // Error handled in store
  }
}

async function handleRequeue(id: string) {
  try {
    await bulkRequeue([id]);
  } catch {
    // Error handled in store
  }
}

async function handleBulkDelete() {
  try {
    await bulkDelete();
  } catch {
    // Error handled in store
  }
}

async function handleBulkRequeue() {
  try {
    await bulkRequeue();
  } catch {
    // Error handled in store
  }
}

async function handleExport() {
  try {
    await exportItems('json');
  } catch {
    // Error handled in store
  }
}

async function handleExportSelected() {
  try {
    const ids = Array.from(selectedIds.value);

    await exportItems('json', ids);
  } catch {
    // Error handled in store
  }
}

async function handleImport(importedItems: ImportItem[]) {
  try {
    await importItems(importedItems);
  } catch {
    // Error handled in store
  }
}

function handleSelectionChange(selectedItems: WishlistEntryWithStatus[]) {
  clearSelection();
  selectedItems.forEach(item => toggleSelection(item.id));
}

function toggleExportMenu(event: Event) {
  exportMenu.value.toggle(event);
}
</script>

<template>
  <div class="wishlist-page">
    <header class="wishlist-page__header">
      <div>
        <h1 class="wishlist-page__title">
          Wishlist
          <span class="wishlist-page__count">({{ total }})</span>
        </h1>
        <p class="wishlist-page__subtitle">
          Manage your music wishlist and track download progress.
        </p>
      </div>

      <div class="wishlist-page__actions">
        <Button
          label="Import"
          icon="pi pi-upload"
          severity="secondary"
          outlined
          @click="importModalVisible = true"
        />
        <Button
          label="Export"
          icon="pi pi-download"
          severity="secondary"
          outlined
          @click="toggleExportMenu"
        />
        <Menu ref="exportMenu" :model="exportMenuItems" popup />
      </div>
    </header>

    <ErrorMessage
      :error="error"
      :loading="loading"
      @retry="fetchWishlist"
    />

    <div class="wishlist-page__filters">
      <WishlistFilters
        :model-value="filters"
        :view-mode="viewMode"
        :selected-count="selectedCount"
        :all-selected="allSelected"
        :some-selected="someSelected"
        @update:model-value="updateFilters($event)"
        @update:view-mode="viewMode = $event"
        @select-all="selectAll"
        @clear-selection="clearSelection"
        @bulk-delete="handleBulkDelete"
        @bulk-requeue="handleBulkRequeue"
      />
    </div>

    <div class="wishlist-page__content">
      <WishlistGrid
        v-if="viewMode === 'grid'"
        :items="items"
        :loading="loading"
        :is-processing="isProcessing"
        :is-selected="isSelected"
        @select="handleSelect"
        @edit="handleEdit"
        @delete="handleDelete"
        @requeue="handleRequeue"
      />

      <WishlistList
        v-else
        :items="items"
        :loading="loading"
        :selected-ids="selectedIds"
        :is-processing="isProcessing"
        @select="handleSelect"
        @edit="handleEdit"
        @delete="handleDelete"
        @requeue="handleRequeue"
        @selection-change="handleSelectionChange"
      />
    </div>

    <div v-if="hasMore && !loading" class="wishlist-page__load-more">
      <Button
        label="Load More"
        icon="pi pi-angle-down"
        outlined
        class="wishlist-page__load-more-btn"
        @click="loadMoreItems"
      />
    </div>

    <div class="wishlist-page__footer">
      <p>{{ items.length }} of {{ total }} items displayed</p>
    </div>

    <!-- Edit Modal -->
    <EditWishlistModal
      v-model:visible="editModalVisible"
      :item="editingItem"
      @save="handleSaveEdit"
    />

    <!-- Import Modal -->
    <ImportWishlistModal
      v-model:visible="importModalVisible"
      @import="handleImport"
    />
  </div>
</template>

<style lang="scss" scoped>
.wishlist-page {
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

  &__actions {
    display: flex;
    gap: 0.75rem;
    flex-wrap: wrap;
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
:deep(.wishlist-page__load-more-btn) {
  background: var(--surface-card);
  border-color: var(--r-border-default);
  color: var(--r-text-primary);
}

:deep(.wishlist-page__load-more-btn:hover) {
  background: var(--r-hover-bg);
  border-color: var(--r-border-emphasis);
}
</style>
