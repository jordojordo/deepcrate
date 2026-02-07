<script setup lang="ts">
import type { ImportItem, ImportResponse, ImportResultItem } from '@/types/wishlist';

import { ref, computed } from 'vue';
import { useBreakpoint } from '@/composables/useBreakpoint';

import Dialog from 'primevue/dialog';
import FileUpload from 'primevue/fileupload';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import Button from 'primevue/button';
import Tag from 'primevue/tag';
import Message from 'primevue/message';

defineProps<{
  visible: boolean;
}>();

const emit = defineEmits<{
  'update:visible': [value: boolean];
  import:           [items: ImportItem[]];
}>();

const { isMobile } = useBreakpoint();

type ImportStep = 'upload' | 'preview' | 'results';

const step = ref<ImportStep>('upload');
const parsedItems = ref<ImportItem[]>([]);
const parseError = ref<string | null>(null);
const importing = ref(false);
const importResults = ref<ImportResponse | null>(null);

const hasItems = computed(() => parsedItems.value.length > 0);

function resetState() {
  step.value = 'upload';
  parsedItems.value = [];
  parseError.value = null;
  importing.value = false;
  importResults.value = null;
}

function closeDialog() {
  emit('update:visible', false);
  // Reset state after close animation
  setTimeout(resetState, 300);
}

function parseJsonFile(content: string): ImportItem[] {
  const data = JSON.parse(content);

  if (!Array.isArray(data)) {
    throw new Error('JSON must be an array of items');
  }

  return data.map((item, index) => {
    if (!item.artist || typeof item.artist !== 'string') {
      throw new Error(`Item ${ index + 1 }: Missing or invalid artist`);
    }
    if (!item.type || !['album', 'track', 'artist'].includes(item.type)) {
      throw new Error(`Item ${ index + 1 }: Invalid type (must be album, track, or artist)`);
    }
    if (item.type !== 'artist' && (!item.title || typeof item.title !== 'string')) {
      throw new Error(`Item ${ index + 1 }: Missing or invalid title`);
    }

    return {
      artist:   item.artist,
      title:    item.title || '',
      type:     item.type,
      year:     item.year || null,
      mbid:     item.mbid || null,
      source:   item.source || null,
      coverUrl: item.coverUrl || null,
    };
  });
}

interface FileUploadSelectEvent {
  files: File[];
}

async function handleFileSelect(event: FileUploadSelectEvent) {
  const file = event.files[0];

  if (!file) {
    return;
  }

  parseError.value = null;

  try {
    const content = await file.text();
    const extension = file.name.toLowerCase().split('.').pop();

    if (extension !== 'json') {
      throw new Error('Unsupported file type. Please upload a JSON file.');
    }

    parsedItems.value = parseJsonFile(content);
    step.value = 'preview';
  } catch(error) {
    parseError.value = error instanceof Error ? error.message : 'Failed to parse file';
    parsedItems.value = [];
  }
}

async function handleImport() {
  importing.value = true;

  try {
    emit('import', parsedItems.value);
    // Note: The actual import results will come from the parent component
    // For now, we'll close on import
    closeDialog();
  } catch {
    // Error is handled by the parent
  } finally {
    importing.value = false;
  }
}

function getResultSeverity(status: ImportResultItem['status']): 'success' | 'warn' | 'danger' {
  if (status === 'added') {
    return 'success';
  }
  if (status === 'skipped') {
    return 'warn';
  }

  return 'danger';
}
</script>

<template>
  <Dialog
    :visible="visible"
    modal
    header="Import Wishlist"
    :style="{ width: isMobile ? '100vw' : (step === 'upload' ? '500px' : '700px') }"
    :closable="!importing"
    @update:visible="$emit('update:visible', $event)"
  >
    <!-- Upload Step -->
    <div v-if="step === 'upload'" class="flex flex-column gap-4">
      <p class="text-muted m-0">
        Upload a JSON file containing wishlist items to import.
      </p>

      <Message v-if="parseError" severity="error" :closable="false">
        {{ parseError }}
      </Message>

      <FileUpload
        mode="basic"
        accept=".json"
        :auto="true"
        choose-label="Choose File"
        class="w-full"
        @select="handleFileSelect"
      />

      <div class="surface-100 border-round p-3">
        <h4 class="mt-0 mb-2">Expected Format</h4>
        <p class="text-sm text-muted mb-2">JSON (array of objects):</p>
        <pre class="text-xs surface-200 p-2 border-round overflow-auto">[
  { "artist": "Artist Name", "title": "Album Title", "type": "album" },
  { "artist": "Artist Name", "title": "Track Title", "type": "track", "year": 2023 }
]</pre>
      </div>
    </div>

    <!-- Preview Step -->
    <div v-else-if="step === 'preview'" class="flex flex-column gap-4">
      <div class="flex justify-content-between align-items-center">
        <p class="m-0 text-muted">
          {{ parsedItems.length }} item(s) found. Review before importing.
        </p>
        <Button
          label="Back"
          icon="pi pi-arrow-left"
          text
          size="small"
          @click="step = 'upload'"
        />
      </div>

      <!-- Mobile card view -->
      <div v-if="isMobile" class="import-mobile">
        <div
          v-for="(item, index) in parsedItems"
          :key="index"
          class="import-mobile__card"
        >
          <div class="import-mobile__info">
            <div class="font-semibold">{{ item.artist }}</div>
            <div class="text-sm text-surface-400">{{ item.title || '—' }}</div>
          </div>
          <div class="import-mobile__meta">
            <Tag :value="item.type" severity="secondary" />
            <span v-if="item.year" class="text-sm text-surface-400">{{ item.year }}</span>
          </div>
        </div>
      </div>

      <!-- Desktop DataTable view -->
      <DataTable
        v-else
        :value="parsedItems"
        :paginator="parsedItems.length > 10"
        :rows="10"
        striped-rows
        class="import-preview-table"
      >
        <Column field="artist" header="Artist"></Column>
        <Column field="title" header="Title"></Column>
        <Column field="type" header="Type" style="width: 100px">
          <template #body="{ data }">
            <Tag :value="data.type" severity="secondary" />
          </template>
        </Column>
        <Column field="year" header="Year" style="width: 80px">
          <template #body="{ data }">
            {{ data.year || '—' }}
          </template>
        </Column>
      </DataTable>
    </div>

    <!-- Results Step -->
    <div v-else-if="step === 'results' && importResults" class="flex flex-column gap-4">
      <Message
        :severity="importResults.errors > 0 ? 'warn' : 'success'"
        :closable="false"
      >
        {{ importResults.message }}
      </Message>

      <div class="flex gap-4">
        <div class="flex-1 surface-100 border-round p-3 text-center">
          <div class="text-2xl font-bold text-green-500">{{ importResults.added }}</div>
          <div class="text-sm text-muted">Added</div>
        </div>
        <div class="flex-1 surface-100 border-round p-3 text-center">
          <div class="text-2xl font-bold text-yellow-500">{{ importResults.skipped }}</div>
          <div class="text-sm text-muted">Skipped</div>
        </div>
        <div class="flex-1 surface-100 border-round p-3 text-center">
          <div class="text-2xl font-bold text-red-500">{{ importResults.errors }}</div>
          <div class="text-sm text-muted">Errors</div>
        </div>
      </div>

      <!-- Mobile card view -->
      <div v-if="isMobile" class="import-mobile">
        <div
          v-for="(item, index) in importResults.results"
          :key="index"
          class="import-mobile__card"
        >
          <div class="import-mobile__info">
            <div class="font-semibold">{{ item.artist }}</div>
            <div class="text-sm text-surface-400">{{ item.title || '—' }}</div>
          </div>
          <div class="import-mobile__meta">
            <Tag
              :value="item.status"
              :severity="getResultSeverity(item.status)"
            />
            <span v-if="item.message" class="text-sm text-surface-400">{{ item.message }}</span>
          </div>
        </div>
      </div>

      <!-- Desktop DataTable view -->
      <DataTable
        v-else
        :value="importResults.results"
        :paginator="importResults.results.length > 10"
        :rows="10"
        striped-rows
      >
        <Column field="artist" header="Artist"></Column>
        <Column field="title" header="Title"></Column>
        <Column field="status" header="Status" style="width: 100px">
          <template #body="{ data }">
            <Tag
              :value="data.status"
              :severity="getResultSeverity(data.status)"
            />
          </template>
        </Column>
        <Column field="message" header="Message">
          <template #body="{ data }">
            {{ data.message || '—' }}
          </template>
        </Column>
      </DataTable>
    </div>

    <template #footer>
      <Button
        label="Cancel"
        severity="secondary"
        text
        :disabled="importing"
        @click="closeDialog"
      />
      <Button
        v-if="step === 'preview'"
        label="Import"
        icon="pi pi-upload"
        :loading="importing"
        :disabled="!hasItems"
        @click="handleImport"
      />
      <Button
        v-if="step === 'results'"
        label="Close"
        @click="closeDialog"
      />
    </template>
  </Dialog>
</template>

<style scoped>
.import-preview-table {
  max-height: 400px;
  overflow: auto;
}

/* Mobile card view */
.import-mobile {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  max-height: 400px;
  overflow: auto;
}

.import-mobile__card {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 0.75rem;
  border-radius: 0.5rem;
  border: 1px solid var(--r-border-default);
  background: var(--p-card-background);
}

.import-mobile__info {
  flex: 1;
  min-width: 0;
}

.import-mobile__meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
}
</style>
