<script setup lang="ts">
import type { CatalogDiscoverySettings, CatalogDiscoveryFormData } from '@/types/settings';

import { reactive, watch, computed } from 'vue';

import Button from 'primevue/button';
import InputText from 'primevue/inputtext';
import InputNumber from 'primevue/inputnumber';
import Select from 'primevue/select';
import ToggleSwitch from 'primevue/toggleswitch';
import Tag from 'primevue/tag';

const props = defineProps<{
  settings: CatalogDiscoverySettings | undefined;
  loading:  boolean;
  saving:   boolean;
}>();

const emit = defineEmits<{
  save: [data: CatalogDiscoveryFormData];
}>();

const modeOptions = [
  { label: 'Manual', value: 'manual' },
  { label: 'Auto', value: 'auto' },
];

const form = reactive<CatalogDiscoveryFormData>({
  enabled:              false,
  navidrome:            {
    host: '', username: '', password: undefined
  },
  lastfm:               { api_key: undefined },
  max_artists_per_run:  10,
  min_similarity:       0.3,
  similar_artist_limit: 10,
  albums_per_artist:    3,
  mode:                 'manual',
});

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

    if (next.navidrome) {
      form.navidrome = {
        host:     next.navidrome.host,
        username: next.navidrome.username,
        password: undefined,
      };
    }

    if (next.lastfm) {
      form.lastfm = { api_key: undefined };
    }
  },
  { immediate: true }
);

const navidromePasswordConfigured = computed(
  () => props.settings?.navidrome?.password?.configured ?? false
);

const lastfmKeyConfigured = computed(
  () => props.settings?.lastfm?.api_key?.configured ?? false
);

function handleSave() {
  const data: CatalogDiscoveryFormData = {
    enabled:              form.enabled,
    max_artists_per_run:  form.max_artists_per_run,
    min_similarity:       form.min_similarity,
    similar_artist_limit: form.similar_artist_limit,
    albums_per_artist:    form.albums_per_artist,
    mode:                 form.mode,
  };

  // Build navidrome object if any field is set
  if (form.navidrome?.host || form.navidrome?.username || form.navidrome?.password) {
    data.navidrome = {};

    if (form.navidrome.host?.trim()) {
      data.navidrome.host = form.navidrome.host.trim();
    }

    if (form.navidrome.username?.trim()) {
      data.navidrome.username = form.navidrome.username.trim();
    }

    if (form.navidrome.password?.trim()) {
      data.navidrome.password = form.navidrome.password.trim();
    }
  }

  // Build lastfm object if key is set
  if (form.lastfm?.api_key?.trim()) {
    data.lastfm = { api_key: form.lastfm.api_key.trim() };
  }

  emit('save', data);
}
</script>

<template>
  <div class="settings-form">
    <div class="settings-form__grid">
      <label class="settings-form__field">
        <span class="settings-form__label">Enabled</span>
        <ToggleSwitch v-model="form.enabled" :disabled="loading" />
      </label>

      <label class="settings-form__field">
        <span class="settings-form__label">Approval Mode</span>
        <Select
          v-model="form.mode"
          :options="modeOptions"
          option-label="label"
          option-value="value"
          :disabled="loading || !form.enabled"
        />
      </label>
    </div>

    <details class="settings-form__section" :open="form.enabled">
      <summary class="settings-form__section-title">Navidrome Connection</summary>
      <div class="settings-form__grid">
        <label class="settings-form__field">
          <span class="settings-form__label">Host</span>
          <InputText
            v-model="form.navidrome!.host"
            :disabled="loading || !form.enabled"
            placeholder="https://music.example.com"
          />
        </label>

        <label class="settings-form__field">
          <span class="settings-form__label">Username</span>
          <InputText
            v-model="form.navidrome!.username"
            :disabled="loading || !form.enabled"
            placeholder="admin"
          />
        </label>

        <label class="settings-form__field">
          <span class="settings-form__label">
            Password
            <Tag
              v-if="navidromePasswordConfigured"
              severity="success"
              value="Configured"
              class="ml-2"
            />
          </span>
          <InputText
            v-model="form.navidrome!.password"
            type="password"
            :disabled="loading || !form.enabled"
            :placeholder="navidromePasswordConfigured ? 'Enter to change' : 'Password'"
          />
        </label>
      </div>
    </details>

    <details class="settings-form__section" :open="form.enabled">
      <summary class="settings-form__section-title">Last.fm API</summary>
      <div class="settings-form__grid">
        <label class="settings-form__field">
          <span class="settings-form__label">
            API Key
            <Tag
              v-if="lastfmKeyConfigured"
              severity="success"
              value="Configured"
              class="ml-2"
            />
          </span>
          <InputText
            v-model="form.lastfm!.api_key"
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
        </label>
      </div>
    </details>

    <details class="settings-form__section" :open="form.enabled">
      <summary class="settings-form__section-title">Discovery Settings</summary>
      <div class="settings-form__grid">
        <label class="settings-form__field">
          <span class="settings-form__label">Max Artists Per Run</span>
          <InputNumber
            v-model="form.max_artists_per_run"
            :disabled="loading || !form.enabled"
            :min="1"
            :max="100"
          />
        </label>

        <label class="settings-form__field">
          <span class="settings-form__label">Min Similarity</span>
          <InputNumber
            v-model="form.min_similarity"
            :disabled="loading || !form.enabled"
            :min="0"
            :max="1"
            :step="0.1"
            :max-fraction-digits="2"
          />
          <span class="settings-form__help">0.0 to 1.0 (higher = more similar)</span>
        </label>

        <label class="settings-form__field">
          <span class="settings-form__label">Similar Artist Limit</span>
          <InputNumber
            v-model="form.similar_artist_limit"
            :disabled="loading || !form.enabled"
            :min="1"
            :max="50"
          />
        </label>

        <label class="settings-form__field">
          <span class="settings-form__label">Albums Per Artist</span>
          <InputNumber
            v-model="form.albums_per_artist"
            :disabled="loading || !form.enabled"
            :min="1"
            :max="20"
          />
        </label>
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
