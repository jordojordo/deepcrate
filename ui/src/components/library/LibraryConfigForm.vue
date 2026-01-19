<script setup lang="ts">
import type { LibraryOrganizationMode, LibraryOrganizeConfig } from '@/types';

import { computed, reactive, watch } from 'vue';

import Button from 'primevue/button';
import InputText from 'primevue/inputtext';
import Select from 'primevue/select';
import ToggleSwitch from 'primevue/toggleswitch';
import Message from 'primevue/message';

const props = defineProps<{
  config:  LibraryOrganizeConfig | null;
  loading: boolean;
  saving:  boolean;
}>();

const emit = defineEmits<{
  save: [config: LibraryOrganizeConfig];
}>();

const organizationOptions = [
  { label: 'Artist / Album', value: 'artist_album' },
  { label: 'Flat', value: 'flat' },
];

interface LibraryOrganizeConfigFormState {
  enabled:           boolean;
  downloads_path:    string;
  library_path:      string;
  organization:      LibraryOrganizationMode;
  interval:          number;
  auto_organize:     boolean;
  delete_after_move: boolean;
  navidrome_rescan:  boolean;
  beets:             { enabled: boolean; command: string };
}

const form = reactive<LibraryOrganizeConfigFormState>({
  enabled:           false,
  downloads_path:    '',
  library_path:      '',
  organization:      'artist_album',
  interval:          0,
  auto_organize:     false,
  delete_after_move: true,
  navidrome_rescan:  false,
  beets:             { enabled: false, command: 'beet import --quiet' },
});

watch(
  () => props.config,
  (next) => {
    if (!next) {
      return;
    }

    Object.assign(form, {
      ...next,
      downloads_path: next.downloads_path ?? '',
      library_path:   next.library_path ?? '',
    });
  },
  { immediate: true }
);

const missingRequiredPaths = computed(() => {
  if (!form.enabled) {
    return false;
  }

  return !form.downloads_path || !form.library_path;
});

const intervalText = computed({
  get: () => String(form.interval ?? 0),
  set: (value: string) => {
    const parsed = parseInt(value, 10);

    if (!Number.isFinite(parsed) || parsed < 0) {
      form.interval = 0;

      return;
    }

    form.interval = parsed;
  },
});

function handleSave() {
  const nextConfig: LibraryOrganizeConfig = {
    enabled:           form.enabled,
    downloads_path:    form.downloads_path.trim() ? form.downloads_path.trim() : null,
    library_path:      form.library_path.trim() ? form.library_path.trim() : null,
    organization:      form.organization,
    interval:          Number.isFinite(form.interval) ? Math.max(0, Math.floor(form.interval)) : 0,
    auto_organize:     form.auto_organize,
    delete_after_move: form.delete_after_move,
    navidrome_rescan:  form.navidrome_rescan,
    beets:             {
      enabled: form.beets.enabled,
      command: form.beets.command?.trim() ? form.beets.command.trim() : 'beet import --quiet',
    },
  };

  emit('save', nextConfig);
}
</script>

<template>
  <div class="library-config">
    <Message v-if="missingRequiredPaths" severity="warn" :closable="false" class="mb-3">
      Downloads path and library path are required when enabled.
    </Message>

    <div class="library-config__grid">
      <label class="library-config__field">
        <span class="library-config__label">Enabled</span>
        <ToggleSwitch v-model="form.enabled" />
      </label>

      <label class="library-config__field">
        <span class="library-config__label">Downloads Path</span>
        <InputText
          v-model="form.downloads_path"
          :disabled="!form.enabled || loading"
          placeholder="/path/to/downloads"
        />
      </label>

      <label class="library-config__field">
        <span class="library-config__label">Library Path</span>
        <InputText
          v-model="form.library_path"
          :disabled="!form.enabled || loading"
          placeholder="/path/to/library"
        />
      </label>

      <label class="library-config__field">
        <span class="library-config__label">Organization</span>
        <Select
          v-model="form.organization"
          :options="organizationOptions"
          option-label="label"
          option-value="value"
          :disabled="!form.enabled || loading"
        />
      </label>

      <label class="library-config__field">
        <span class="library-config__label">Interval (seconds)</span>
        <InputText
          v-model="intervalText"
          type="number"
          min="0"
          :disabled="loading"
          placeholder="0"
        />
        <span class="library-config__help">Set to 0 for manual-only. Requires `auto_organize=true` to schedule.</span>
      </label>

      <label class="library-config__field">
        <span class="library-config__label">Auto Organize</span>
        <ToggleSwitch v-model="form.auto_organize" :disabled="!form.enabled || loading" />
      </label>

      <label class="library-config__field">
        <span class="library-config__label">Delete After Move</span>
        <ToggleSwitch v-model="form.delete_after_move" :disabled="!form.enabled || loading" />
      </label>

      <label class="library-config__field">
        <span class="library-config__label">Navidrome Rescan</span>
        <ToggleSwitch v-model="form.navidrome_rescan" :disabled="!form.enabled || loading" />
      </label>
    </div>

    <details class="library-config__details" :open="form.beets.enabled">
      <summary class="library-config__summary">Beets</summary>
      <div class="library-config__details-body">
        <label class="library-config__field">
          <span class="library-config__label">Enabled</span>
          <ToggleSwitch v-model="form.beets.enabled" :disabled="!form.enabled || loading" />
        </label>

        <label class="library-config__field">
          <span class="library-config__label">Command</span>
          <InputText
            v-model="form.beets.command"
            :disabled="!form.enabled || !form.beets.enabled || loading"
            placeholder="beet import --quiet"
          />
        </label>
      </div>
    </details>

    <div class="library-config__actions">
      <Button
        label="Save Configuration"
        icon="pi pi-save"
        :disabled="loading || saving || !config"
        :loading="saving"
        @click="handleSave"
      />
    </div>
  </div>
</template>

<style scoped>
.library-config__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1rem;
}

@media (max-width: 768px) {
  .library-config__grid {
    grid-template-columns: 1fr;
  }
}

.library-config__field {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.library-config__label {
  color: var(--surface-200);
  font-size: 0.875rem;
  font-weight: 600;
}

.library-config__help {
  color: var(--surface-400);
  font-size: 0.75rem;
}

.library-config__details {
  margin-top: 1rem;
  padding: 1rem;
  border-radius: 0.75rem;
  border: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.08));
  background: var(--surface-glass, rgba(21, 21, 37, 0.7));
}

.library-config__summary {
  cursor: pointer;
  color: var(--r-text-primary);
  font-weight: 700;
}

.library-config__details-body {
  margin-top: 1rem;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1rem;
}

@media (max-width: 768px) {
  .library-config__details-body {
    grid-template-columns: 1fr;
  }
}

.library-config__actions {
  margin-top: 1.5rem;
  display: flex;
  justify-content: flex-end;
}
</style>
