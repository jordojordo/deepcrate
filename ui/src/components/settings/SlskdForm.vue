<script setup lang="ts">
import type {
  SlskdSettings,
  SlskdFormData,
  SlskdForm,
} from '@/types/settings';

import { reactive, ref, watch, computed } from 'vue';
import { useSettings } from '@/composables/useSettings';

import Button from 'primevue/button';
import InputText from 'primevue/inputtext';
import InputNumber from 'primevue/inputnumber';
import Select from 'primevue/select';
import ToggleSwitch from 'primevue/toggleswitch';
import Tag from 'primevue/tag';
import AutoComplete from 'primevue/autocomplete';
import Message from 'primevue/message';

const props = defineProps<{
  settings: SlskdSettings | undefined;
  loading:  boolean;
  saving:   boolean;
}>();

const emit = defineEmits<{
  save: [data: SlskdFormData];
}>();

const { validateSection } = useSettings();

const selectionModeOptions = [
  { label: 'Manual', value: 'manual' },
  { label: 'Auto', value: 'auto' },
];

// Static suggestion lists for AutoComplete fields
const FORMAT_SUGGESTIONS = ['flac', 'wav', 'alac', 'aiff', 'mp3', 'm4a', 'aac', 'ogg', 'opus', 'wma'];
const EXCLUDE_TERM_SUGGESTIONS = ['live', 'remix', 'demo', 'cover', 'acoustic', 'instrumental', 'remaster', 'bootleg', 'karaoke', 'tribute'];
const FALLBACK_QUERY_SUGGESTIONS = ['{artist}', '{album}', '{artist} {album}', '{artist} discography', '{artist} {album} {year}'];

const filteredFormats = ref<string[]>([]);
const filteredExcludeTerms = ref<string[]>([]);
const filteredFallbackQueries = ref<string[]>([]);

const errors = ref<Array<{ path: string; message: string }>>([]);
const urlError = ref<string | null>(null);

const form = reactive<SlskdForm>({
  host:             '',
  api_key:          undefined,
  url_base:         '/',
  search_timeout:   15000,
  min_album_tracks: 3,
  search:           {
    album_query_template:   '{artist} {album}',
    track_query_template:   '{artist} {title}',
    fallback_queries:       [],
    exclude_terms:          [],
    min_file_size_mb:       1,
    max_file_size_mb:       500,
    prefer_complete_albums: true,
    prefer_album_folder:    true,
    retry:                  {
      enabled:                  false,
      max_attempts:             3,
      simplify_on_retry:        true,
      delay_between_retries_ms: 5000,
    },
    quality_preferences: {
      enabled:            false,
      preferred_formats:  ['flac', 'wav', 'alac', 'mp3', 'm4a', 'ogg'],
      min_bitrate:        256,
      prefer_lossless:    true,
      reject_low_quality: false,
      reject_lossless:    false,
    },
  },
  selection: { mode: 'manual', timeout_hours: 24 },
});

watch(
  () => props.settings,
  (next) => {
    if (!next) {
      return;
    }

    form.host = next.host;
    form.url_base = next.url_base;
    form.search_timeout = next.search_timeout;
    form.min_album_tracks = next.min_album_tracks;
    form.api_key = undefined;

    if (next.search && form.search) {
      Object.assign(form.search, next.search);
    }

    if (next.selection && form.selection) {
      Object.assign(form.selection, next.selection);
    }
  },
  { immediate: true }
);

const apiKeyConfigured = computed(() => props.settings?.api_key?.configured ?? false);

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

  if (form.host && !isValidUrl(form.host)) {
    urlError.value = 'Invalid URL format. Please enter a valid URL (e.g., https://slskd.example.com)';

    return;
  }

  const data: SlskdFormData = {
    host:             form.host.trim(),
    url_base:         form.url_base.trim() || '/',
    search_timeout:   form.search_timeout,
    min_album_tracks: form.min_album_tracks,
    search:           form.search,
    selection:        form.selection,
  };

  if (form.api_key?.trim()) {
    data.api_key = form.api_key.trim();
  }

  const validation = await validateSection('slskd', data);

  if (!validation.valid && validation.errors) {
    errors.value = validation.errors;

    return;
  }

  emit('save', data);
}

// AutoComplete search handlers - include query as option for custom values
function searchFormats(event: { query: string }) {
  const query = event.query.trim();
  const queryLower = query.toLowerCase();
  const filtered = query ? FORMAT_SUGGESTIONS.filter(f => f.toLowerCase().includes(queryLower)) : [...FORMAT_SUGGESTIONS];

  // Add query as first option if it's not already in the list (allows custom values)
  if (query && !filtered.some(f => f.toLowerCase() === queryLower)) {
    filtered.unshift(query);
  }
  filteredFormats.value = filtered;
}

function searchExcludeTerms(event: { query: string }) {
  const query = event.query.trim();
  const queryLower = query.toLowerCase();
  const filtered = query ? EXCLUDE_TERM_SUGGESTIONS.filter(t => t.toLowerCase().includes(queryLower)) : [...EXCLUDE_TERM_SUGGESTIONS];

  if (query && !filtered.some(t => t.toLowerCase() === queryLower)) {
    filtered.unshift(query);
  }
  filteredExcludeTerms.value = filtered;
}

function searchFallbackQueries(event: { query: string }) {
  const query = event.query.trim();
  const queryLower = query.toLowerCase();
  const filtered = query ? FALLBACK_QUERY_SUGGESTIONS.filter(q => q.toLowerCase().includes(queryLower)) : [...FALLBACK_QUERY_SUGGESTIONS];

  if (query && !filtered.some(q => q.toLowerCase() === queryLower)) {
    filtered.unshift(query);
  }
  filteredFallbackQueries.value = filtered;
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
        <label for="setting-slskd-host" class="settings-form__label">Host</label>
        <InputText
          id="setting-slskd-host"
          v-model="form.host"
          :disabled="loading"
          placeholder="https://slskd.example.com"
        />
      </div>

      <div class="settings-form__field">
        <label for="setting-slskd-api-key" class="settings-form__label">
          API Key
          <Tag
            v-if="apiKeyConfigured"
            severity="success"
            value="Configured"
            class="ml-2"
          />
        </label>
        <InputText
          id="setting-slskd-api-key"
          v-model="form.api_key"
          type="password"
          :disabled="loading"
          :placeholder="apiKeyConfigured ? 'Enter to change' : 'API key'"
        />
      </div>

      <div class="settings-form__field">
        <label for="setting-slskd-url-base" class="settings-form__label">URL Base</label>
        <InputText
          id="setting-slskd-url-base"
          v-model="form.url_base"
          :disabled="loading"
          placeholder="/"
        />
      </div>

      <div class="settings-form__field">
        <label for="setting-slskd-search-timeout" class="settings-form__label">
          Search Timeout (ms)
        </label>
        <InputNumber
          id="setting-slskd-search-timeout"
          v-model="form.search_timeout"
          :disabled="loading"
          :min="1000"
          :max="60000"
          :step="1000"
        />
      </div>

      <div class="settings-form__field">
        <label for="setting-slskd-min-tracks" class="settings-form__label">
          Min Album Tracks
        </label>
        <InputNumber
          id="setting-slskd-min-tracks"
          v-model="form.min_album_tracks"
          :disabled="loading"
          :min="1"
          :max="30"
        />
      </div>

      <div class="settings-form__field">
        <label for="setting-slskd-selection-mode" class="settings-form__label">
          Selection Mode
        </label>
        <Select
          id="setting-slskd-selection-mode"
          v-model="form.selection.mode"
          :options="selectionModeOptions"
          option-label="label"
          option-value="value"
          :disabled="loading"
        />
      </div>
    </div>

    <details class="settings-form__section">
      <summary class="settings-form__section-title">Search Settings</summary>
      <div class="settings-form__grid settings-form__grid--with-margin">
        <div class="settings-form__field">
          <label for="setting-slskd-album-query" class="settings-form__label">
            Album Query Template
          </label>
          <InputText
            id="setting-slskd-album-query"
            v-model="form.search.album_query_template"
            :disabled="loading"
            placeholder="{artist} {album}"
          />
          <span class="settings-form__help">
            Variables: {artist}, {album}, {year}
          </span>
        </div>

        <div class="settings-form__field">
          <label for="setting-slskd-track-query" class="settings-form__label">
            Track Query Template
          </label>
          <InputText
            id="setting-slskd-track-query"
            v-model="form.search.track_query_template"
            :disabled="loading"
            placeholder="{artist} {title}"
          />
          <span class="settings-form__help">
            Variables: {artist}, {title}
          </span>
        </div>

        <div class="settings-form__field settings-form__field--full">
          <label for="setting-slskd-fallback-queries" class="settings-form__label">
            Fallback Queries
          </label>
          <AutoComplete
            v-model="form.search.fallback_queries"
            :suggestions="filteredFallbackQueries"
            :disabled="loading"
            input-id="setting-slskd-fallback-queries"
            multiple
            fluid
            @complete="searchFallbackQueries"
          />
        </div>

        <div class="settings-form__field settings-form__field--full">
          <label for="setting-slskd-exclude-terms" class="settings-form__label">
            Exclude Terms
          </label>
          <AutoComplete
            v-model="form.search.exclude_terms"
            :suggestions="filteredExcludeTerms"
            :disabled="loading"
            input-id="setting-slskd-exclude-terms"
            multiple
            fluid
            @complete="searchExcludeTerms"
          />
        </div>

        <div class="settings-form__field">
          <label for="setting-slskd-min-file-size" class="settings-form__label">
            Min File Size (MB)
          </label>
          <InputNumber
            id="setting-slskd-min-file-size"
            v-model="form.search.min_file_size_mb"
            :disabled="loading"
            :min="0"
            :max="1000"
          />
        </div>

        <div class="settings-form__field">
          <label for="setting-slskd-max-file-size" class="settings-form__label">
            Max File Size (MB)
          </label>
          <InputNumber
            id="setting-slskd-max-file-size"
            v-model="form.search.max_file_size_mb"
            :disabled="loading"
            :min="1"
            :max="10000"
          />
        </div>

        <div class="settings-form__field">
          <label for="setting-slskd-prefer-complete" class="settings-form__label">
            Prefer Complete Albums
          </label>
          <ToggleSwitch
            id="setting-slskd-prefer-complete"
            v-model="form.search.prefer_complete_albums"
            :disabled="loading"
          />
        </div>

        <div class="settings-form__field">
          <label for="setting-slskd-prefer-folder" class="settings-form__label">
            Prefer Album Folder
          </label>
          <ToggleSwitch
            id="setting-slskd-prefer-folder"
            v-model="form.search.prefer_album_folder"
            :disabled="loading"
          />
        </div>
      </div>
    </details>

    <details class="settings-form__section">
      <summary class="settings-form__section-title">Retry Settings</summary>
      <div class="settings-form__grid settings-form__grid--with-margin">
        <div class="settings-form__field">
          <label for="setting-slskd-retry-enabled" class="settings-form__label">
            Enabled
          </label>
          <ToggleSwitch
            id="setting-slskd-retry-enabled"
            v-model="form.search.retry.enabled"
            :disabled="loading"
          />
        </div>

        <div class="settings-form__field">
          <label for="setting-slskd-retry-max" class="settings-form__label">
            Max Attempts
          </label>
          <InputNumber
            id="setting-slskd-retry-max"
            v-model="form.search.retry.max_attempts"
            :disabled="loading || !form.search.retry.enabled"
            :min="1"
            :max="10"
          />
        </div>

        <div class="settings-form__field">
          <label for="setting-slskd-retry-simplify" class="settings-form__label">
            Simplify On Retry
          </label>
          <ToggleSwitch
            id="setting-slskd-retry-simplify"
            v-model="form.search.retry.simplify_on_retry"
            :disabled="loading || !form.search.retry.enabled"
          />
        </div>

        <div class="settings-form__field">
          <label for="setting-slskd-retry-delay" class="settings-form__label">
            Delay Between Retries (ms)
          </label>
          <InputNumber
            id="setting-slskd-retry-delay"
            v-model="form.search.retry.delay_between_retries_ms"
            :disabled="loading || !form.search.retry.enabled"
            :min="0"
            :max="60000"
            :step="1000"
          />
        </div>
      </div>
    </details>

    <details class="settings-form__section">
      <summary class="settings-form__section-title">Quality Preferences</summary>
      <div class="settings-form__grid settings-form__grid--with-margin">
        <div class="settings-form__field">
          <label for="setting-slskd-quality-enabled" class="settings-form__label">
            Enabled
          </label>
          <ToggleSwitch
            id="setting-slskd-quality-enabled"
            v-model="form.search.quality_preferences.enabled"
            :disabled="loading"
          />
        </div>

        <div class="settings-form__field">
          <label for="setting-slskd-min-bitrate" class="settings-form__label">
            Min Bitrate
          </label>
          <InputNumber
            id="setting-slskd-min-bitrate"
            v-model="form.search.quality_preferences.min_bitrate"
            :disabled="loading || !form.search.quality_preferences.enabled"
            :min="0"
            :max="9999"
          />
        </div>

        <div class="settings-form__field">
          <label for="setting-slskd-prefer-lossless" class="settings-form__label">
            Prefer Lossless
          </label>
          <ToggleSwitch
            id="setting-slskd-prefer-lossless"
            v-model="form.search.quality_preferences.prefer_lossless"
            :disabled="loading || !form.search.quality_preferences.enabled"
          />
        </div>

        <div class="settings-form__field">
          <label for="setting-slskd-reject-low" class="settings-form__label">
            Reject Low Quality
          </label>
          <ToggleSwitch
            id="setting-slskd-reject-low"
            v-model="form.search.quality_preferences.reject_low_quality"
            :disabled="loading || !form.search.quality_preferences.enabled"
          />
        </div>

        <div class="settings-form__field">
          <label for="setting-slskd-reject-lossless" class="settings-form__label">
            Reject Lossless
          </label>
          <ToggleSwitch
            id="setting-slskd-reject-lossless"
            v-model="form.search.quality_preferences.reject_lossless"
            :disabled="loading || !form.search.quality_preferences.enabled"
          />
        </div>

        <div class="settings-form__field settings-form__field--full">
          <label for="setting-slskd-preferred-formats" class="settings-form__label">
            Preferred Formats
          </label>
          <AutoComplete
            v-model="form.search.quality_preferences.preferred_formats"
            :suggestions="filteredFormats"
            :disabled="loading || !form.search.quality_preferences.enabled"
            input-id="setting-slskd-preferred-formats"
            multiple
            fluid
            @complete="searchFormats"
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
