<script setup lang="ts">
import type { ScoringSettings, ScoringFormData } from '@/types';

import { reactive, watch } from 'vue';

import Button from 'primevue/button';
import ToggleSwitch from 'primevue/toggleswitch';

const props = defineProps<{
  settings: ScoringSettings | undefined;
  loading:  boolean;
  saving:   boolean;
}>();

const emit = defineEmits<{
  save: [data: ScoringFormData];
}>();

const form = reactive({ musicbrainz_ratings: true });

watch(
  () => props.settings,
  (next) => {
    if (next) form.musicbrainz_ratings = next.musicbrainz_ratings;
  },
  { immediate: true }
);

function handleSave() {
  emit('save', { musicbrainz_ratings: form.musicbrainz_ratings });
}
</script>

<template>
  <div class="settings-form">
    <div class="settings-form__grid">
      <div class="settings-form__field">
        <label for="setting-scoring-mb-ratings" class="settings-form__label">
          MusicBrainz Ratings
        </label>
        <ToggleSwitch
          id="setting-scoring-mb-ratings"
          v-model="form.musicbrainz_ratings"
          :disabled="loading"
        />
        <span class="settings-form__help">
          Apply a score bonus to albums with high MusicBrainz community ratings.
          Disable to use only genre and source-based scoring.
        </span>
      </div>
    </div>

    <div class="settings-form__actions">
      <Button
        label="Save"
        icon="pi pi-save"
        :disabled="loading || saving"
        :loading="saving"
        @click="handleSave"
      />
    </div>
  </div>
</template>
