<script setup lang="ts">
import type { PreviewSettings, PreviewFormData, PreviewForm } from '@/types/settings';

import { reactive, ref, watch, computed } from 'vue';
import { useSettings } from '@/composables/useSettings';

import Button from 'primevue/button';
import InputText from 'primevue/inputtext';
import ToggleSwitch from 'primevue/toggleswitch';
import Tag from 'primevue/tag';
import Message from 'primevue/message';

const props = defineProps<{
  settings: PreviewSettings | undefined;
  loading:  boolean;
  saving:   boolean;
}>();

const emit = defineEmits<{
  save: [data: PreviewFormData];
}>();

const { validateSection } = useSettings();

const form = reactive<PreviewForm>({
  enabled: true,
  spotify: {
    enabled:       false,
    client_id:     undefined,
    client_secret: undefined,
  },
});

const errors = ref<Array<{ path: string; message: string }>>([]);

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

async function handleSave() {
  errors.value = [];

  const data: PreviewFormData = { enabled: form.enabled };

  if (form.spotify) {
    const spotifyData = {
      enabled: form.spotify.enabled,
      ...(form.spotify.client_id?.trim() && { client_id: form.spotify.client_id.trim() }),
      ...(form.spotify.client_secret?.trim() && { client_secret: form.spotify.client_secret.trim() }),
    };

    data.spotify = spotifyData;
  }

  const validation = await validateSection('preview', data);

  if (!validation.valid && validation.errors) {
    errors.value = validation.errors;

    return;
  }

  emit('save', data);
}
</script>

<template>
  <div class="settings-form">
    <Message
      v-if="errors.length > 0"
      severity="error"
      :closable="false"
      class="settings-form__error"
    >
      <div class="flex">
        <span v-for="error in errors" :key="error.path">{{ error.message }}</span>
      </div>
    </Message>

    <div class="settings-form__grid">
      <div class="settings-form__field">
        <label for="setting-preview-enabled" class="settings-form__label">
          Preview Enabled
        </label>
        <ToggleSwitch
          id="setting-preview-enabled"
          v-model="form.enabled"
          :disabled="loading"
        />
        <span class="settings-form__help">
          Enable audio preview functionality in the queue.
        </span>
      </div>
    </div>

    <details class="settings-form__section" :open="form.enabled">
      <summary class="settings-form__section-title">Spotify Integration</summary>
      <div class="settings-form__grid settings-form__grid--with-margin">
        <div class="settings-form__field">
          <label for="setting-preview-spotify-enabled" class="settings-form__label">
            Enabled
          </label>
          <ToggleSwitch
            id="setting-preview-spotify-enabled"
            v-model="form.spotify.enabled"
            :disabled="loading || !form.enabled"
          />
        </div>

        <div />

        <div class="settings-form__field">
          <label for="setting-preview-spotify-client-id" class="settings-form__label">
            Client ID
            <Tag
              v-if="clientIdConfigured"
              severity="success"
              value="Configured"
              class="ml-2"
            />
          </label>
          <InputText
            id="setting-preview-spotify-client-id"
            v-model="form.spotify.client_id"
            type="password"
            :disabled="loading || !form.enabled || !form.spotify.enabled"
            :placeholder="clientIdConfigured ? 'Enter to change' : 'Spotify Client ID'"
          />
        </div>

        <div class="settings-form__field">
          <label for="setting-preview-spotify-client-secret" class="settings-form__label">
            Client Secret
            <Tag
              v-if="clientSecretConfigured"
              severity="success"
              value="Configured"
              class="ml-2"
            />
          </label>
          <InputText
            id="setting-preview-spotify-client-secret"
            v-model="form.spotify.client_secret"
            type="password"
            :disabled="loading || !form.enabled || !form.spotify.enabled"
            :placeholder="clientSecretConfigured ? 'Enter to change' : 'Spotify Client Secret'"
          />
        </div>

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
