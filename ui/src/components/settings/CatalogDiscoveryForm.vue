<script setup lang="ts">
import type { CatalogDiscoverySettings, CatalogDiscoveryFormData, CatalogDiscoveryForm } from '@/types/settings';

import { reactive, ref, watch, computed } from 'vue';

import Button from 'primevue/button';
import InputText from 'primevue/inputtext';
import InputNumber from 'primevue/inputnumber';
import Select from 'primevue/select';
import ToggleSwitch from 'primevue/toggleswitch';
import Tag from 'primevue/tag';
import Message from 'primevue/message';

import { useSettings } from '@/composables/useSettings';

const props = defineProps<{
  settings: CatalogDiscoverySettings | undefined;
  loading:  boolean;
  saving:   boolean;
}>();

const emit = defineEmits<{
  save: [data: CatalogDiscoveryFormData];
}>();

const { validateSection } = useSettings();

const modeOptions = [
  { label: 'Manual', value: 'manual' },
  { label: 'Auto', value: 'auto' },
];

const form = reactive<CatalogDiscoveryForm>({
  enabled:              false,
  subsonic: {
    host:     '',
    username: '',
    password: undefined,
  },
  lastfm:               { api_key: undefined },
  max_artists_per_run:  10,
  min_similarity:       0.3,
  similar_artist_limit: 10,
  albums_per_artist:    3,
  mode:                 'manual',
});

const errors = ref<Array<{ path: string; message: string }>>([]);
const urlError = ref<string | null>(null);

watch(
  () => props.settings,
  (next) => {
    if (!next) {
      return;
    }

    form.enabled = next.enabled;
    form.max_artists_per_run = next.max_artists_per_run;
    form.min_similarity = next.min_similarity;
    form.similar_artist_limit = next.similar_artist_limit;
    form.albums_per_artist = next.albums_per_artist;
    form.mode = next.mode;

    if (next.subsonic) {
      form.subsonic = {
        host:     next.subsonic.host,
        username: next.subsonic.username,
        password: undefined,
      };
    }

    if (next.lastfm) {
      form.lastfm = { api_key: undefined };
    }
  },
  { immediate: true }
);

const subsonicPasswordConfigured = computed(
  () => props.settings?.subsonic?.password?.configured ?? false
);

const lastfmKeyConfigured = computed(
  () => props.settings?.lastfm?.api_key?.configured ?? false
);

function isValidUrl(url: string): boolean {
  if (!url.trim()) {
    return true; // Empty is allowed
  }

  try {
    new URL(url);

    return true;
  } catch {
    return false;
  }
}

async function handleSave() {
  errors.value = [];
  urlError.value = null;

  const host = form.subsonic?.host;

  if (host && !isValidUrl(host)) {
    urlError.value = 'Invalid Subsonic server URL format. Please enter a valid URL (e.g., https://music.example.com)';

    return;
  }

  const data: CatalogDiscoveryFormData = {
    enabled:              form.enabled,
    max_artists_per_run:  form.max_artists_per_run,
    min_similarity:       form.min_similarity,
    similar_artist_limit: form.similar_artist_limit,
    albums_per_artist:    form.albums_per_artist,
    mode:                 form.mode,
  };

  // Build subsonic object using spread pattern if any field is set
  const subsonicData = {
    ...(form.subsonic?.host?.trim() && { host: form.subsonic.host.trim() }),
    ...(form.subsonic?.username?.trim() && { username: form.subsonic.username.trim() }),
    ...(form.subsonic?.password?.trim() && { password: form.subsonic.password.trim() }),
  };

  if (Object.keys(subsonicData).length > 0) {
    data.subsonic = subsonicData;
  }

  // Build lastfm object if key is set
  if (form.lastfm?.api_key?.trim()) {
    data.lastfm = { api_key: form.lastfm.api_key.trim() };
  }

  const validation = await validateSection('catalog_discovery', data);

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
      v-if="errors.length > 0 || urlError"
      severity="error"
      :closable="false"
      class="settings-form__error"
    >
      <div class="flex">
        <span v-if="urlError">{{ urlError }}</span>
        <span v-for="error in errors" :key="error.path">{{ error.message }}</span>
      </div>
    </Message>

    <div class="settings-form__grid">
      <div class="settings-form__field">
        <label for="setting-catalog-enabled" class="settings-form__label">Enabled</label>
        <ToggleSwitch
          id="setting-catalog-enabled"
          v-model="form.enabled"
          :disabled="loading"
        />
      </div>

      <div class="settings-form__field">
        <label for="setting-catalog-mode" class="settings-form__label">Approval Mode</label>
        <Select
          id="setting-catalog-mode"
          v-model="form.mode"
          :options="modeOptions"
          option-label="label"
          option-value="value"
          :disabled="loading || !form.enabled"
        />
      </div>
    </div>

    <details class="settings-form__section" :open="form.enabled">
      <summary class="settings-form__section-title">Subsonic Server</summary>
      <div class="settings-form__grid settings-form__grid--with-margin">
        <div class="settings-form__field">
          <label for="setting-catalog-subsonic-host" class="settings-form__label">Host</label>
          <InputText
            id="setting-catalog-subsonic-host"
            v-model="form.subsonic.host"
            :disabled="loading || !form.enabled"
            placeholder="https://music.example.com"
          />
        </div>

        <div class="settings-form__field">
          <label for="setting-catalog-subsonic-username" class="settings-form__label">
            Username
          </label>
          <InputText
            id="setting-catalog-subsonic-username"
            v-model="form.subsonic.username"
            :disabled="loading || !form.enabled"
            placeholder="admin"
          />
        </div>

        <div class="settings-form__field">
          <label for="setting-catalog-subsonic-password" class="settings-form__label">
            Password
            <Tag
              v-if="subsonicPasswordConfigured"
              severity="success"
              value="Configured"
              class="ml-2"
            />
          </label>
          <InputText
            id="setting-catalog-subsonic-password"
            v-model="form.subsonic.password"
            type="password"
            :disabled="loading || !form.enabled"
            :placeholder="subsonicPasswordConfigured ? 'Enter to change' : 'Password'"
          />
        </div>
      </div>
    </details>

    <details class="settings-form__section" :open="form.enabled">
      <summary class="settings-form__section-title">Last.fm API</summary>
      <div class="settings-form__grid settings-form__grid--with-margin">
        <div class="settings-form__field">
          <label for="setting-catalog-lastfm-key" class="settings-form__label">
            API Key
            <Tag
              v-if="lastfmKeyConfigured"
              severity="success"
              value="Configured"
              class="ml-2"
            />
          </label>
          <InputText
            id="setting-catalog-lastfm-key"
            v-model="form.lastfm.api_key"
            type="password"
            :disabled="loading || !form.enabled"
            :placeholder="lastfmKeyConfigured ? 'Enter to change' : 'API key'"
          />
          <span class="settings-form__help">
            Get your key from
            <a href="https://www.last.fm/api/account/create" target="_blank" rel="noopener">
              last.fm/api
            </a>
          </span>
        </div>
      </div>
    </details>

    <details class="settings-form__section" :open="form.enabled">
      <summary class="settings-form__section-title">Discovery Settings</summary>
      <div class="settings-form__grid settings-form__grid--with-margin">
        <div class="settings-form__field">
          <label for="setting-catalog-max-artists" class="settings-form__label">
            Max Artists Per Run
          </label>
          <InputNumber
            id="setting-catalog-max-artists"
            v-model="form.max_artists_per_run"
            :disabled="loading || !form.enabled"
            :min="1"
            :max="100"
          />
        </div>

        <div class="settings-form__field">
          <label for="setting-catalog-min-similarity" class="settings-form__label">
            Min Similarity
          </label>
          <InputNumber
            id="setting-catalog-min-similarity"
            v-model="form.min_similarity"
            :disabled="loading || !form.enabled"
            :min="0"
            :max="1"
            :step="0.1"
            :max-fraction-digits="2"
          />
          <span class="settings-form__help">0.0 to 1.0 (higher = more similar)</span>
        </div>

        <div class="settings-form__field">
          <label for="setting-catalog-similar-limit" class="settings-form__label">
            Similar Artist Limit
          </label>
          <InputNumber
            id="setting-catalog-similar-limit"
            v-model="form.similar_artist_limit"
            :disabled="loading || !form.enabled"
            :min="1"
            :max="50"
          />
        </div>

        <div class="settings-form__field">
          <label for="setting-catalog-albums-per-artist" class="settings-form__label">
            Albums Per Artist
          </label>
          <InputNumber
            id="setting-catalog-albums-per-artist"
            v-model="form.albums_per_artist"
            :disabled="loading || !form.enabled"
            :min="1"
            :max="20"
          />
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
