<script setup lang="ts">
import type { SearchResult } from '@/types/search';

import { ref, watch } from 'vue';
import Dialog from 'primevue/dialog';
import InputText from 'primevue/inputtext';
import SelectButton from 'primevue/selectbutton';
import Button from 'primevue/button';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import ProgressSpinner from 'primevue/progressspinner';

import { searchMusicBrainz } from '@/services/search';
import { addToWishlist } from '@/services/wishlist';
import { useToast } from '@/composables/useToast';
import { useBreakpoint } from '@/composables/useBreakpoint';

const visible = defineModel<boolean>('visible', { default: false });

const searchQuery = ref('');
const searchType = ref<'album' | 'artist' | 'track'>('album');
const results = ref<SearchResult[]>([]);
const loading = ref(false);
const addingMbid = ref<string | null>(null);

const typeOptions = [
  { label: 'Album', value: 'album' },
  { label: 'Artist', value: 'artist' },
  { label: 'Track', value: 'track' },
];

const { showSuccess, showError } = useToast();
const { isMobile } = useBreakpoint();

let debounceTimeout: ReturnType<typeof setTimeout> | null = null;
let abortController: AbortController | null = null;

watch(searchQuery, (newQuery) => {
  if (debounceTimeout) {
    clearTimeout(debounceTimeout);
  }

  if (newQuery.trim().length < 2) {
    results.value = [];

    return;
  }

  debounceTimeout = setTimeout(() => {
    performSearch();
  }, 300);
});

watch(searchType, () => {
  if (searchQuery.value.trim().length >= 2) {
    performSearch();
  }
});

async function performSearch() {
  if (abortController) {
    abortController.abort();
  }

  abortController = new AbortController();

  if (searchQuery.value.trim().length < 2) {
    return;
  }

  loading.value = true;

  try {
    const response = await searchMusicBrainz(searchQuery.value, searchType.value);

    results.value = response.results;
  } catch(e) {
    const message = e instanceof Error ? e.message : 'Search failed';

    showError('Search failed', message);
    results.value = [];
  } finally {
    loading.value = false;
  }
}

async function handleSearch() {
  if (debounceTimeout) {
    clearTimeout(debounceTimeout);
  }
  performSearch();
}

async function handleAdd(item: SearchResult) {
  addingMbid.value = item.mbid;

  try {
    // Map search type to wishlist type
    const wishlistType = searchType.value;

    // For artists, title is empty (search will use just artist name)
    const title = searchType.value === 'artist' ? '' : item.title;

    await addToWishlist({
      artist: item.artist,
      title,
      type:   wishlistType,
    });

    let displayText: string;

    if (searchType.value === 'artist') {
      displayText = item.artist;
    } else if (searchType.value === 'track' && item.album) {
      displayText = `${ item.artist } - ${ item.title } (from ${ item.album })`;
    } else {
      displayText = `${ item.artist } - ${ item.title }`;
    }

    showSuccess('Added to wishlist', displayText);
  } catch(e) {
    const message = e instanceof Error ? e.message : 'Failed to add to wishlist';

    showError('Failed to add', message);
  } finally {
    addingMbid.value = null;
  }
}

function handleClose() {
  visible.value = false;
  searchQuery.value = '';
  results.value = [];
}
</script>

<template>
  <Dialog
    v-model:visible="visible"
    header="Add to Wishlist"
    :modal="true"
    :closable="true"
    :style="{ width: isMobile ? '100vw' : '50rem' }"
    @hide="handleClose"
  >
    <!-- Search Section -->
    <div class="flex flex-column gap-4">
      <div class="flex flex-wrap align-items-end gap-3">
        <div class="flex flex-column gap-2 grow">
          <label for="search-query" class="text-sm font-medium">Search</label>
          <InputText
            id="search-query"
            v-model="searchQuery"
            placeholder="Search for albums or artists..."
            class="w-full"
            @keyup.enter="handleSearch"
          />
        </div>

        <div class="flex flex-column gap-2">
          <label class="text-sm font-medium">Type</label>
          <SelectButton
            v-model="searchType"
            :options="typeOptions"
            option-label="label"
            option-value="value"
          />
        </div>

        <Button
          icon="pi pi-search"
          label="Search"
          :loading="loading"
          @click="handleSearch"
        />
      </div>

      <div class="results-container relative" style="min-height: 400px">
        <div
          v-if="loading"
          class="absolute top-0 left-0 right-0 bottom-0 flex align-items-center justify-content-center z-1"
          style="background: rgba(var(--surface-ground-rgb), 0.7)"
        >
          <ProgressSpinner style="width: 48px; height: 48px" />
        </div>

        <div v-if="results.length > 0">
          <!-- Mobile card view -->
          <div v-if="isMobile" class="search-mobile">
            <div
              v-for="item in results"
              :key="item.mbid"
              class="search-mobile__card"
            >
              <div class="search-mobile__header">
                <img
                  v-if="item.coverArt"
                  :src="item.coverArt"
                  :alt="`${ item.artist } - ${ item.title }`"
                  class="search-mobile__cover"
                />
                <div
                  v-else
                  class="search-mobile__cover search-mobile__cover--placeholder"
                >
                  <i class="pi pi-image text-muted"></i>
                </div>
                <div class="search-mobile__info">
                  <div class="font-semibold">{{ item.artist }}</div>
                  <div class="text-sm text-surface-400">{{ item.title }}</div>
                  <div v-if="searchType === 'track' && item.album" class="text-xs text-surface-400">{{ item.album }}</div>
                  <div v-if="item.year" class="text-xs text-surface-400">{{ item.year }}</div>
                </div>
                <Button
                  icon="pi pi-plus"
                  size="small"
                  rounded
                  outlined
                  :loading="addingMbid === item.mbid"
                  :disabled="addingMbid !== null"
                  @click="handleAdd(item)"
                />
              </div>
            </div>
          </div>

          <!-- Desktop DataTable view -->
          <DataTable v-else :value="results" :paginator="false" class="p-datatable-sm">
            <Column header="Cover" style="width: 60px">
              <template #body="{ data }">
                <img
                  v-if="data.coverArt"
                  :src="data.coverArt"
                  :alt="`${ data.artist } - ${ data.title }`"
                  class="border-round"
                  style="width: 50px; height: 50px; object-fit: cover"
                />
                <div
                  v-else
                  class="border-round bg-surface-200 dark:bg-surface-700 flex align-items-center justify-content-center"
                  style="width: 50px; height: 50px"
                >
                  <i class="pi pi-image text-muted"></i>
                </div>
              </template>
            </Column>
            <Column field="artist" header="Artist" />
            <Column field="title" header="Title" />
            <Column v-if="searchType === 'track'" field="album" header="Album" />
            <Column field="year" header="Year" style="width: 80px" />
            <Column header="Actions" style="width: 100px">
              <template #body="{ data }">
                <Button
                  icon="pi pi-plus"
                  size="small"
                  rounded
                  outlined
                  :loading="addingMbid === data.mbid"
                  :disabled="addingMbid !== null"
                  @click="handleAdd(data)"
                />
              </template>
            </Column>
          </DataTable>
        </div>

        <div
          v-else-if="searchQuery.trim().length >= 2 && !loading"
          class="text-center py-6 text-muted"
        >
          <i class="pi pi-search text-4xl mb-3"></i>
          <p>No results found. Try a different search term.</p>
        </div>

        <div v-else-if="!loading" class="text-center py-6 text-muted">
          <i class="pi pi-search text-4xl mb-3"></i>
          <p>Enter a search term to find albums, artists, or tracks.</p>
        </div>
      </div>
    </div>
  </Dialog>
</template>

<style scoped>
/* Mobile card view */
.search-mobile {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.search-mobile__card {
  padding: 0.75rem;
  border-radius: 0.5rem;
  border: 1px solid var(--r-border-default);
  background: var(--p-card-background);
}

.search-mobile__header {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
}

.search-mobile__cover {
  width: 50px;
  height: 50px;
  border-radius: 0.25rem;
  object-fit: cover;
  flex-shrink: 0;
}

.search-mobile__cover--placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--surface-200);
}

:deep(.dark) .search-mobile__cover--placeholder {
  background: var(--surface-700);
}

.search-mobile__info {
  flex: 1;
  min-width: 0;
}
</style>
