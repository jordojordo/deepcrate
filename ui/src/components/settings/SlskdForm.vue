<script setup lang="ts">
import type { SlskdSettings, SlskdFormData } from '@/types/settings';

import { reactive, ref, watch, computed } from 'vue';

import Button from 'primevue/button';
import InputText from 'primevue/inputtext';
import InputNumber from 'primevue/inputnumber';
import Select from 'primevue/select';
import ToggleSwitch from 'primevue/toggleswitch';
import Tag from 'primevue/tag';
import AutoComplete from 'primevue/autocomplete';

const props = defineProps<{
  settings: SlskdSettings | undefined;
  loading:  boolean;
  saving:   boolean;
}>();

const emit = defineEmits<{
  save: [data: SlskdFormData];
}>();

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

const form = reactive<SlskdFormData>({
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

    if (next.search) {
      Object.assign(form.search!, next.search);
    }

    if (next.selection) {
      Object.assign(form.selection!, next.selection);
    }
  },
  { immediate: true }
);

const apiKeyConfigured = computed(() => props.settings?.api_key?.configured ?? false);

function handleSave() {
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
    <div class="settings-form__grid">
      <label class="settings-form__field">
        <span class="settings-form__label">Host</span>
        <InputText
          v-model="form.host"
          :disabled="loading"
          placeholder="https://slskd.example.com"
        />
      </label>

      <label class="settings-form__field">
        <span class="settings-form__label">
          API Key
          <Tag
            v-if="apiKeyConfigured"
            severity="success"
            value="Configured"
            class="ml-2"
          />
        </span>
        <InputText
          v-model="form.api_key"
          type="password"
          :disabled="loading"
          :placeholder="apiKeyConfigured ? 'Enter to change' : 'API key'"
        />
      </label>

      <label class="settings-form__field">
        <span class="settings-form__label">URL Base</span>
        <InputText
          v-model="form.url_base"
          :disabled="loading"
          placeholder="/"
        />
      </label>

      <label class="settings-form__field">
        <span class="settings-form__label">Search Timeout (ms)</span>
        <InputNumber
          v-model="form.search_timeout"
          :disabled="loading"
          :min="1000"
          :max="60000"
          :step="1000"
        />
      </label>

      <label class="settings-form__field">
        <span class="settings-form__label">Min Album Tracks</span>
        <InputNumber
          v-model="form.min_album_tracks"
          :disabled="loading"
          :min="1"
          :max="30"
        />
      </label>

      <label class="settings-form__field">
        <span class="settings-form__label">Selection Mode</span>
        <Select
          v-model="form.selection!.mode"
          :options="selectionModeOptions"
          option-label="label"
          option-value="value"
          :disabled="loading"
        />
      </label>
    </div>

    <details class="settings-form__section">
      <summary class="settings-form__section-title">Search Settings</summary>
      <div class="settings-form__grid">
        <label class="settings-form__field">
          <span class="settings-form__label">Album Query Template</span>
          <InputText
            v-model="form.search!.album_query_template"
            :disabled="loading"
            placeholder="{artist} {album}"
          />
          <span class="settings-form__help">
            Variables: {artist}, {album}, {year}
          </span>
        </label>

        <label class="settings-form__field">
          <span class="settings-form__label">Track Query Template</span>
          <InputText
            v-model="form.search!.track_query_template"
            :disabled="loading"
            placeholder="{artist} {title}"
          />
          <span class="settings-form__help">
            Variables: {artist}, {title}
          </span>
        </label>

        <label class="settings-form__field settings-form__field--full">
          <label for="fallback-queries" class="settings-form__label">Fallback Queries</label>
          <AutoComplete
            v-model="form.search!.fallback_queries"
            :suggestions="filteredFallbackQueries"
            :disabled="loading"
            inputId="fallback-queries"
            multiple
            fluid
            @complete="searchFallbackQueries"
          />
        </label>

        <label class="settings-form__field settings-form__field--full">
          <label for="exclude-terms" class="settings-form__label">Exclude Terms</label>
          <AutoComplete
            v-model="form.search!.exclude_terms"
            :suggestions="filteredExcludeTerms"
            :disabled="loading"
            inputId="exclude-terms"
            multiple
            fluid
            @complete="searchExcludeTerms"
          />
        </label>

        <label class="settings-form__field">
          <span class="settings-form__label">Min File Size (MB)</span>
          <InputNumber
            v-model="form.search!.min_file_size_mb"
            :disabled="loading"
            :min="0"
            :max="1000"
          />
        </label>

        <label class="settings-form__field">
          <span class="settings-form__label">Max File Size (MB)</span>
          <InputNumber
            v-model="form.search!.max_file_size_mb"
            :disabled="loading"
            :min="1"
            :max="10000"
          />
        </label>

        <label class="settings-form__field">
          <span class="settings-form__label">Prefer Complete Albums</span>
          <ToggleSwitch v-model="form.search!.prefer_complete_albums" :disabled="loading" />
        </label>

        <label class="settings-form__field">
          <span class="settings-form__label">Prefer Album Folder</span>
          <ToggleSwitch v-model="form.search!.prefer_album_folder" :disabled="loading" />
        </label>
      </div>
    </details>

    <details class="settings-form__section">
      <summary class="settings-form__section-title">Retry Settings</summary>
      <div class="settings-form__grid">
        <label class="settings-form__field">
          <span class="settings-form__label">Enabled</span>
          <ToggleSwitch v-model="form.search!.retry.enabled" :disabled="loading" />
        </label>

        <label class="settings-form__field">
          <span class="settings-form__label">Max Attempts</span>
          <InputNumber
            v-model="form.search!.retry.max_attempts"
            :disabled="loading || !form.search!.retry.enabled"
            :min="1"
            :max="10"
          />
        </label>

        <label class="settings-form__field">
          <span class="settings-form__label">Simplify On Retry</span>
          <ToggleSwitch
            v-model="form.search!.retry.simplify_on_retry"
            :disabled="loading || !form.search!.retry.enabled"
          />
        </label>

        <label class="settings-form__field">
          <span class="settings-form__label">Delay Between Retries (ms)</span>
          <InputNumber
            v-model="form.search!.retry.delay_between_retries_ms"
            :disabled="loading || !form.search!.retry.enabled"
            :min="0"
            :max="60000"
            :step="1000"
          />
        </label>
      </div>
    </details>

    <details class="settings-form__section">
      <summary class="settings-form__section-title">Quality Preferences</summary>
      <div class="settings-form__grid">
        <label class="settings-form__field">
          <span class="settings-form__label">Enabled</span>
          <ToggleSwitch v-model="form.search!.quality_preferences!.enabled" :disabled="loading" />
        </label>

        <label class="settings-form__field">
          <span class="settings-form__label">Min Bitrate</span>
          <InputNumber
            v-model="form.search!.quality_preferences!.min_bitrate"
            :disabled="loading || !form.search!.quality_preferences!.enabled"
            :min="0"
            :max="9999"
          />
        </label>

        <label class="settings-form__field">
          <span class="settings-form__label">Prefer Lossless</span>
          <ToggleSwitch
            v-model="form.search!.quality_preferences!.prefer_lossless"
            :disabled="loading || !form.search!.quality_preferences!.enabled"
          />
        </label>

        <label class="settings-form__field">
          <span class="settings-form__label">Reject Low Quality</span>
          <ToggleSwitch
            v-model="form.search!.quality_preferences!.reject_low_quality"
            :disabled="loading || !form.search!.quality_preferences!.enabled"
          />
        </label>

        <label class="settings-form__field">
          <span class="settings-form__label">Reject Lossless</span>
          <ToggleSwitch
            v-model="form.search!.quality_preferences!.reject_lossless"
            :disabled="loading || !form.search!.quality_preferences!.enabled"
          />
        </label>

        <label class="settings-form__field settings-form__field--full">
          <label for="preferred-formats" class="settings-form__label">Preferred Formats</label>
          <AutoComplete
            v-model="form.search!.quality_preferences!.preferred_formats"
            :suggestions="filteredFormats"
            :disabled="loading || !form.search!.quality_preferences!.enabled"
            inputId="preferred-formats"
            multiple
            fluid
            @complete="searchFormats"
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
