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

const visible = defineModel<boolean>('visible', { default: false });

const searchQuery = ref('');
const searchType = ref<'album' | 'artist'>('album');
const results = ref<SearchResult[]>([]);
const loading = ref(false);
const addingMbid = ref<string | null>(null);

const typeOptions = [
  { label: 'Album', value: 'album' },
  { label: 'Artist', value: 'artist' },
];

const { showSuccess, showError } = useToast();

let debounceTimeout: ReturnType<typeof setTimeout> | null = null;

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
    await addToWishlist({
      artist: item.artist,
      title:  item.title,
      type:   searchType.value === 'album' ? 'album' : 'track',
    });
    showSuccess('Added to wishlist', `${ item.artist } - ${ item.title }`);
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
    :style="{ width: '50rem' }"
    @hide="handleClose"
  >
    <!-- Search Section -->
    <div class="flex flex-column gap-4">
      <div class="flex flex-wrap align-items-end gap-3">
        <div class="flex flex-column gap-2 flex-grow-1">
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

      <!-- Loading State -->
      <div v-if="loading" class="flex justify-content-center py-6">
        <ProgressSpinner style="width: 48px; height: 48px" />
      </div>

      <!-- Results Section -->
      <div v-else-if="results.length > 0">
        <DataTable :value="results" :paginator="false" class="p-datatable-sm">
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

      <!-- Empty State -->
      <div
        v-else-if="searchQuery.trim().length >= 2 && !loading"
        class="text-center py-6 text-muted"
      >
        <i class="pi pi-search text-4xl mb-3"></i>
        <p>No results found. Try a different search term.</p>
      </div>

      <!-- Initial State -->
      <div v-else class="text-center py-6 text-muted">
        <i class="pi pi-search text-4xl mb-3"></i>
        <p>Enter a search term to find albums or artists.</p>
      </div>
    </div>
  </Dialog>
</template>
