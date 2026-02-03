<script setup lang="ts">
import type { WishlistEntryWithStatus, UpdateWishlistRequest, WishlistItemType, WishlistItemSource } from '@/types/wishlist';

import { ref, watch } from 'vue';

import Dialog from 'primevue/dialog';
import InputText from 'primevue/inputtext';
import InputNumber from 'primevue/inputnumber';
import Select from 'primevue/select';
import Checkbox from 'primevue/checkbox';
import Button from 'primevue/button';

const props = defineProps<{
  visible: boolean;
  item:    WishlistEntryWithStatus | null;
}>();

const emit = defineEmits<{
  'update:visible': [value: boolean];
  save:             [id: string, data: UpdateWishlistRequest];
}>();

const typeOptions: Array<{ label: string; value: WishlistItemType }> = [
  { label: 'Album', value: 'album' },
  { label: 'Track', value: 'track' },
  { label: 'Artist', value: 'artist' },
];

const sourceOptions: Array<{ label: string; value: WishlistItemSource }> = [
  { label: 'ListenBrainz', value: 'listenbrainz' },
  { label: 'Catalog', value: 'catalog' },
  { label: 'Manual', value: 'manual' },
];

// Form state
const formData = ref<{
  artist:             string;
  title:              string;
  type:               WishlistItemType;
  year:               number | null;
  mbid:               string;
  source:             WishlistItemSource;
  coverUrl:           string;
  resetDownloadState: boolean;
}>({
  artist:             '',
  title:              '',
  type:               'album',
  year:               null,
  mbid:               '',
  source:             'manual',
  coverUrl:           '',
  resetDownloadState: false,
});

const saving = ref(false);

// Reset form when item changes
watch(
  () => props.item,
  (item) => {
    if (item) {
      formData.value = {
        artist:             item.artist,
        title:              item.title,
        type:               item.type,
        year:               item.year ?? null,
        mbid:               item.mbid ?? '',
        source:             item.source ?? 'manual',
        coverUrl:           item.coverUrl ?? '',
        resetDownloadState: false,
      };
    }
  },
  { immediate: true }
);

function closeDialog() {
  emit('update:visible', false);
}

async function handleSave() {
  if (!props.item) {
    return;
  }

  saving.value = true;

  try {
    const updates: UpdateWishlistRequest = {};

    // Only include changed fields
    if (formData.value.artist !== props.item.artist) {
      updates.artist = formData.value.artist;
    }
    if (formData.value.title !== props.item.title) {
      updates.title = formData.value.title;
    }
    if (formData.value.type !== props.item.type) {
      updates.type = formData.value.type;
    }
    if (formData.value.year !== props.item.year) {
      updates.year = formData.value.year;
    }
    if (formData.value.mbid !== (props.item.mbid ?? '')) {
      updates.mbid = formData.value.mbid || null;
    }
    if (formData.value.source !== (props.item.source ?? 'manual')) {
      updates.source = formData.value.source;
    }
    if (formData.value.coverUrl !== (props.item.coverUrl ?? '')) {
      updates.coverUrl = formData.value.coverUrl || null;
    }
    if (formData.value.resetDownloadState) {
      updates.resetDownloadState = true;
    }

    emit('save', props.item.id, updates);
    closeDialog();
  } finally {
    saving.value = false;
  }
}

const isProcessed = (item: WishlistEntryWithStatus | null) => {
  if (!item) {
    return false;
  }

  return item.processedAt !== null || item.downloadStatus !== 'none';
};
</script>

<template>
  <Dialog
    :visible="visible"
    modal
    header="Edit Wishlist Item"
    :style="{ width: '500px' }"
    :closable="!saving"
    @update:visible="$emit('update:visible', $event)"
  >
    <div v-if="item" class="flex flex-column gap-4">
      <!-- Artist -->
      <div class="flex flex-column gap-2">
        <label for="edit-artist" class="font-medium">Artist</label>
        <InputText
          id="edit-artist"
          v-model="formData.artist"
          :disabled="saving"
          class="w-full"
        />
      </div>

      <!-- Title -->
      <div class="flex flex-column gap-2">
        <label for="edit-title" class="font-medium">Title</label>
        <InputText
          id="edit-title"
          v-model="formData.title"
          :disabled="saving"
          class="w-full"
        />
      </div>

      <!-- Type & Year -->
      <div class="flex gap-4">
        <div class="flex flex-column gap-2 flex-1">
          <label for="edit-type" class="font-medium">Type</label>
          <Select
            id="edit-type"
            v-model="formData.type"
            :options="typeOptions"
            option-label="label"
            option-value="value"
            :disabled="saving"
            class="w-full"
          />
        </div>
        <div class="flex flex-column gap-2 flex-1">
          <label for="edit-year" class="font-medium">Year</label>
          <InputNumber
            id="edit-year"
            v-model="formData.year"
            :disabled="saving"
            :min="1900"
            :max="2100"
            :use-grouping="false"
            class="w-full"
          />
        </div>
      </div>

      <!-- Source -->
      <div class="flex flex-column gap-2">
        <label for="edit-source" class="font-medium">Source</label>
        <Select
          id="edit-source"
          v-model="formData.source"
          :options="sourceOptions"
          option-label="label"
          option-value="value"
          :disabled="saving"
          class="w-full"
        />
      </div>

      <!-- MusicBrainz ID -->
      <div class="flex flex-column gap-2">
        <label for="edit-mbid" class="font-medium">MusicBrainz ID</label>
        <InputText
          id="edit-mbid"
          v-model="formData.mbid"
          :disabled="saving"
          placeholder="Optional"
          class="w-full"
        />
      </div>

      <!-- Cover URL -->
      <div class="flex flex-column gap-2">
        <label for="edit-cover" class="font-medium">Cover URL</label>
        <InputText
          id="edit-cover"
          v-model="formData.coverUrl"
          :disabled="saving"
          placeholder="Optional"
          class="w-full"
        />
      </div>

      <!-- Reset download state -->
      <div v-if="isProcessed(item)" class="flex align-items-center gap-2 p-3 surface-100 border-round">
        <Checkbox
          id="edit-reset"
          v-model="formData.resetDownloadState"
          binary
          :disabled="saving"
        />
        <label for="edit-reset" class="cursor-pointer">
          Re-queue for download (reset download status)
        </label>
      </div>
    </div>

    <template #footer>
      <Button
        label="Cancel"
        severity="secondary"
        text
        :disabled="saving"
        @click="closeDialog"
      />
      <Button
        label="Save"
        icon="pi pi-check"
        :loading="saving"
        @click="handleSave"
      />
    </template>
  </Dialog>
</template>
