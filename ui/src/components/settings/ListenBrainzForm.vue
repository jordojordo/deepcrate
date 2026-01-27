<script setup lang="ts">
import type { ListenBrainzSettings, ListenBrainzFormData } from '@/types/settings';

import { reactive, watch, computed } from 'vue';

import Button from 'primevue/button';
import InputText from 'primevue/inputtext';
import Select from 'primevue/select';
import Tag from 'primevue/tag';

const props = defineProps<{
  settings: ListenBrainzSettings | undefined;
  loading:  boolean;
  saving:   boolean;
}>();

const emit = defineEmits<{
  save: [data: ListenBrainzFormData];
}>();

const approvalModeOptions = [
  { label: 'Manual', value: 'manual' },
  { label: 'Auto', value: 'auto' },
];

const sourceTypeOptions = [
  { label: 'Weekly Playlist', value: 'weekly_playlist' },
  { label: 'Collaborative Filtering', value: 'collaborative' },
];

const form = reactive<ListenBrainzFormData>({
  username:      '',
  token:         undefined,
  approval_mode: 'manual',
  source_type:   'weekly_playlist',
});

watch(
  () => props.settings,
  (next) => {
    if (!next) {
      return;
    }

    form.username = next.username;
    form.approval_mode = next.approval_mode;
    form.source_type = next.source_type;
    // Don't set token - keep it undefined so we know user hasn't touched it
    form.token = undefined;
  },
  { immediate: true }
);

const tokenConfigured = computed(() => props.settings?.token?.configured ?? false);

function handleSave() {
  const data: ListenBrainzFormData = {
    username:      form.username.trim(),
    approval_mode: form.approval_mode,
    source_type:   form.source_type,
  };

  // Only include token if user entered a new one
  if (form.token?.trim()) {
    data.token = form.token.trim();
  }

  emit('save', data);
}
</script>

<template>
  <div class="settings-form">
    <div class="settings-form__grid">
      <label class="settings-form__field">
        <span class="settings-form__label">Username</span>
        <InputText
          v-model="form.username"
          :disabled="loading"
          placeholder="Your ListenBrainz username"
        />
      </label>

      <label class="settings-form__field">
        <span class="settings-form__label">
          API Token
          <Tag
            v-if="tokenConfigured"
            severity="success"
            value="Configured"
            class="ml-2"
          />
          <Tag
            v-else
            severity="warn"
            value="Not configured"
            class="ml-2"
          />
        </span>
        <InputText
          v-model="form.token"
          :disabled="loading"
          type="password"
          :placeholder="tokenConfigured ? 'Enter new token to change' : 'Enter API token'"
        />
        <span class="settings-form__help">
          Get your token from
          <a href="https://listenbrainz.org/profile/" target="_blank" rel="noopener">
            listenbrainz.org/profile
          </a>
        </span>
      </label>

      <label class="settings-form__field">
        <span class="settings-form__label">Approval Mode</span>
        <Select
          v-model="form.approval_mode"
          :options="approvalModeOptions"
          option-label="label"
          option-value="value"
          :disabled="loading"
        />
        <span class="settings-form__help">
          Auto mode will automatically approve new discoveries.
        </span>
      </label>

      <label class="settings-form__field">
        <span class="settings-form__label">Source Type</span>
        <Select
          v-model="form.source_type"
          :options="sourceTypeOptions"
          option-label="label"
          option-value="value"
          :disabled="loading"
        />
        <span class="settings-form__help">
          Weekly playlists don't require a token. CF recommendations need one.
        </span>
      </label>
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

<style scoped>
.settings-form__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1rem;
}

@media (max-width: 768px) {
  .settings-form__grid {
    grid-template-columns: 1fr;
  }
}

.settings-form__field {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.settings-form__label {
  color: var(--surface-200);
  font-size: 0.875rem;
  font-weight: 600;
  display: flex;
  align-items: center;
}

.settings-form__help {
  color: var(--surface-400);
  font-size: 0.75rem;
}

.settings-form__help a {
  color: var(--primary-color);
}

.settings-form__actions {
  margin-top: 1.5rem;
  display: flex;
  justify-content: flex-end;
}
</style>
