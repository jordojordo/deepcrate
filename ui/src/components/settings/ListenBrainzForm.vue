<script setup lang="ts">
import type { ListenBrainzSettings, ListenBrainzFormData } from '@/types';

import { reactive, ref, watch, computed } from 'vue';

import Button from 'primevue/button';
import InputText from 'primevue/inputtext';
import Select from 'primevue/select';
import Tag from 'primevue/tag';
import Message from 'primevue/message';

import { useSettings } from '@/composables/useSettings';

const props = defineProps<{
  settings: ListenBrainzSettings | undefined;
  loading:  boolean;
  saving:   boolean;
}>();

const emit = defineEmits<{
  save: [data: ListenBrainzFormData];
}>();

const { validateSection } = useSettings();

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

const errors = ref<Array<{ path: string; message: string }>>([]);

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

async function handleSave() {
  errors.value = [];

  const data: ListenBrainzFormData = {
    username:      form.username.trim(),
    approval_mode: form.approval_mode,
    source_type:   form.source_type,
  };

  // Only include token if user entered a new one
  if (form.token?.trim()) {
    data.token = form.token.trim();
  }

  const validation = await validateSection('listenbrainz', data);

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
        <label for="setting-listenbrainz-username" class="settings-form__label">
          Username
        </label>
        <InputText
          id="setting-listenbrainz-username"
          v-model="form.username"
          :disabled="loading"
          placeholder="Your ListenBrainz username"
        />
      </div>

      <div class="settings-form__field">
        <label for="setting-listenbrainz-token" class="settings-form__label">
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
        </label>
        <InputText
          id="setting-listenbrainz-token"
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
      </div>

      <div class="settings-form__field">
        <label for="setting-listenbrainz-approval-mode" class="settings-form__label">
          Approval Mode
        </label>
        <Select
          id="setting-listenbrainz-approval-mode"
          v-model="form.approval_mode"
          :options="approvalModeOptions"
          option-label="label"
          option-value="value"
          :disabled="loading"
        />
        <span class="settings-form__help">
          Auto mode will automatically approve new discoveries.
        </span>
      </div>

      <div class="settings-form__field">
        <label for="setting-listenbrainz-source-type" class="settings-form__label">
          Source Type
        </label>
        <Select
          id="setting-listenbrainz-source-type"
          v-model="form.source_type"
          :options="sourceTypeOptions"
          option-label="label"
          option-value="value"
          :disabled="loading"
        />
        <span class="settings-form__help">
          Weekly playlists don't require a token. CF recommendations need one.
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
