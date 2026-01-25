<script setup lang="ts">
import { ref } from 'vue';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import Button from 'primevue/button';
import Tag from 'primevue/tag';
import ProgressSpinner from 'primevue/progressspinner';
import type { QueueItem } from '@/types';
import { getDefaultCoverUrl } from '@/utils/formatters';

defineProps<{
  items:   QueueItem[] | undefined;
  loading: boolean;
}>();

const emit = defineEmits<{
  approve: [mbids: string[]];
  reject:  [mbids: string[]];
}>();

const selectedItems = ref<QueueItem[]>([]);

function approveSelected() {
  const mbids = selectedItems.value.map(item => item.mbid);

  emit('approve', mbids);
  selectedItems.value = [];
}

function rejectSelected() {
  const mbids = selectedItems.value.map(item => item.mbid);

  emit('reject', mbids);
  selectedItems.value = [];
}

function approveItem(item: QueueItem) {
  emit('approve', [item.mbid]);
}

function rejectItem(item: QueueItem) {
  emit('reject', [item.mbid]);
}

function getSourceSeverity(source: string) {
  return source === 'listenbrainz' ? 'info' : 'secondary';
}

function getSimilarTag(similarTo: string[] | undefined): string | null {
  if (similarTo && similarTo.length > 0) {
    const first = similarTo[0];
    const remaining = similarTo.length - 1;

    if (remaining > 0) {
      return `Similar to ${ first } (+${ remaining })`;
    }

    return `Similar to ${ first }`;
  }

  return null;
}

function getSimilarTooltip(similarTo: string[] | undefined): string | null {
  if (similarTo && similarTo.length > 1) {
    return `Similar to ${ similarTo.join(', ') }`;
  }

  return null;
}


</script>

<template>
  <div>
    <div v-if="selectedItems.length > 0" class="mb-4 p-3 surface-card border-round-lg">
      <div class="flex align-items-center justify-content-between">
        <span class="text-sm text-muted">
          {{ selectedItems.length }} of {{ items?.length }} selected
        </span>
        <div class="flex gap-2">
          <Button
            label="Approve Selected"
            icon="pi pi-check"
            severity="success"
            size="small"
            @click="approveSelected"
          />
          <Button
            label="Reject Selected"
            icon="pi pi-times"
            severity="danger"
            size="small"
            outlined
            @click="rejectSelected"
          />
        </div>
      </div>
    </div>

    <div v-if="loading && !items?.length" class="flex justify-content-center py-6">
      <ProgressSpinner style="width: 64px; height: 64px" />
    </div>

    <div
      v-else-if="!items || items.length === 0"
      class="surface-card border-round-lg p-8 text-center"
    >
      <i class="pi pi-inbox text-6xl text-muted mb-4"></i>
      <h3 class="text-xl font-semibold mb-2">No pending items</h3>
      <p class="text-muted">The queue is empty. Check back later for new recommendations.</p>
    </div>

    <DataTable
      v-else
      :value="items"
      v-model:selection="selectedItems"
      data-key="mbid"
      :loading="loading"
      striped-rows
      responsive-layout="scroll"
    >
      <Column selection-mode="multiple" header-style="width: 3rem"></Column>

      <Column field="cover_url" header="Cover" style="width: 100px">
        <template #body="{ data }">
          <img
            :src="data.cover_url || getDefaultCoverUrl()"
            :alt="`${data.album || data.title} cover`"
            class="w-16 h-16 border-round object-cover"
            @error="($event.target as HTMLImageElement).src = getDefaultCoverUrl()"
          />
        </template>
      </Column>

      <Column field="album" header="Album/Title">
        <template #body="{ data }">
          <div>
            <div class="font-semibold">{{ data.album || data.title }}</div>
            <div class="text-sm text-muted">{{ data.artist }}</div>
            <div v-if="data.year" class="text-sm text-muted mt-1">{{ data.year }}</div>
          </div>
        </template>
      </Column>

      <Column field="source" header="Source" style="width: 150px">
        <template #body="{ data }">
          <div class="flex flex-column gap-1">
            <Tag
              :value="data.source === 'listenbrainz' ? 'ListenBrainz' : 'Catalog'"
              :severity="getSourceSeverity(data.source)"
            />
            <Tag
              v-if="data.in_library"
              value="In Library"
              severity="success"
              class="w-fit"
            />
          </div>
        </template>
      </Column>

      <Column field="similar_to" header="Similar To" style="width: 180px">
        <template #body="{ data }">
          <Tag
            v-if="getSimilarTag(data.similar_to)"
            :value="getSimilarTag(data.similar_to)"
            v-tooltip.bottom="getSimilarTooltip(data.similar_to)"
            icon="pi pi-link"
          />
          <span v-else class="text-muted">—</span>
        </template>
      </Column>

      <Column field="score" header="Score" style="width: 100px">
        <template #body="{ data }">
          <span v-if="data.score" class="text-sm">{{ data.score }}%</span>
          <span v-else class="text-sm">N/A</span>
        </template>
      </Column>

      <Column header="Actions" style="width: auto">
        <template #body="{ data }">
          <div class="flex gap-2">
            <Button
              icon="pi pi-check"
              severity="success"
              size="small"
              @click="approveItem(data)"
            />
            <Button
              icon="pi pi-times"
              severity="danger"
              size="small"
              outlined
              @click="rejectItem(data)"
            />
          </div>
        </template>
      </Column>
    </DataTable>

    <div v-if="loading && items && items.length > 0" class="flex justify-content-center py-4">
      <ProgressSpinner style="width: 48px; height: 48px" />
    </div>
  </div>
</template>
