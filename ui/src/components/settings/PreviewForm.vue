<script setup lang="ts">
import type { PreviewSettings, PreviewFormData } from '@/types/settings';

import { reactive, watch, computed } from 'vue';

import Button from 'primevue/button';
import InputText from 'primevue/inputtext';
import ToggleSwitch from 'primevue/toggleswitch';
import Tag from 'primevue/tag';

const props = defineProps<{
  settings: PreviewSettings | undefined;
  loading:  boolean;
  saving:   boolean;
}>();

const emit = defineEmits<{
  save: [data: PreviewFormData];
}>();

const form = reactive<PreviewFormData>({
  enabled: true,
  spotify: {
    enabled:       false,
    client_id:     undefined,
    client_secret: undefined,
  },
});

watch(
  () => props.settings,
  (next) => {
    if (!next) {
      return;
    }

    form.enabled = next.enabled;

    if (next.spotify) {
      form.spotify = {
        enabled:       next.spotify.enabled,
        client_id:     undefined,
        client_secret: undefined,
      };
    }
  },
  { immediate: true }
);

const clientIdConfigured = computed(
  () => props.settings?.spotify?.client_id?.configured ?? false
);

const clientSecretConfigured = computed(
  () => props.settings?.spotify?.client_secret?.configured ?? false
);

function handleSave() {
  const data: PreviewFormData = { enabled: form.enabled };

  if (form.spotify) {
    data.spotify = { enabled: form.spotify.enabled };

    if (form.spotify.client_id?.trim()) {
      data.spotify.client_id = form.spotify.client_id.trim();
    }

    if (form.spotify.client_secret?.trim()) {
      data.spotify.client_secret = form.spotify.client_secret.trim();
    }
  }

  emit('save', data);
}
</script>

<template>
  <div class="settings-form">
    <div class="settings-form__grid">
      <label class="settings-form__field">
        <span class="settings-form__label">Preview Enabled</span>
        <ToggleSwitch v-model="form.enabled" :disabled="loading" />
        <span class="settings-form__help">
          Enable audio preview functionality in the queue.
        </span>
      </label>
    </div>

    <details class="settings-form__section" :open="form.enabled">
      <summary class="settings-form__section-title">Spotify Integration</summary>
      <div class="settings-form__grid">
        <label class="settings-form__field">
          <span class="settings-form__label">Enabled</span>
          <ToggleSwitch
            v-model="form.spotify!.enabled"
            :disabled="loading || !form.enabled"
          />
        </label>

        <div />

        <label class="settings-form__field">
          <span class="settings-form__label">
            Client ID
            <Tag
              v-if="clientIdConfigured"
              severity="success"
              value="Configured"
              class="ml-2"
            />
          </span>
          <InputText
            v-model="form.spotify!.client_id"
            type="password"
            :disabled="loading || !form.enabled || !form.spotify!.enabled"
            :placeholder="clientIdConfigured ? 'Enter to change' : 'Spotify Client ID'"
          />
        </label>

        <label class="settings-form__field">
          <span class="settings-form__label">
            Client Secret
            <Tag
              v-if="clientSecretConfigured"
              severity="success"
              value="Configured"
              class="ml-2"
            />
          </span>
          <InputText
            v-model="form.spotify!.client_secret"
            type="password"
            :disabled="loading || !form.enabled || !form.spotify!.enabled"
            :placeholder="clientSecretConfigured ? 'Enter to change' : 'Spotify Client Secret'"
          />
        </label>

        <div class="settings-form__field settings-form__field--full">
          <span class="settings-form__help">
            Create an app at
            <a href="https://developer.spotify.com/dashboard" target="_blank" rel="noopener">
              developer.spotify.com/dashboard
            </a>
            to get your credentials.
          </span>
        </div>
      </div>
    </details>

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
  margin-top: 1rem;
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

.settings-form__field--full {
  grid-column: 1 / -1;
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

.settings-form__section {
  margin-top: 1rem;
  padding: 1rem;
  border-radius: 0.75rem;
  border: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.08));
  background: var(--surface-glass, rgba(21, 21, 37, 0.7));
}

.settings-form__section-title {
  cursor: pointer;
  color: var(--r-text-primary);
  font-weight: 700;
}

.settings-form__actions {
  margin-top: 1.5rem;
  display: flex;
  justify-content: flex-end;
}
</style>
