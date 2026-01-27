<script setup lang="ts">
import type { UISettings, AuthFormData } from '@/types/settings';

import { reactive, watch, computed } from 'vue';

import Button from 'primevue/button';
import InputText from 'primevue/inputtext';
import Select from 'primevue/select';
import ToggleSwitch from 'primevue/toggleswitch';
import Tag from 'primevue/tag';
import Message from 'primevue/message';

const props = defineProps<{
  settings: UISettings | undefined;
  loading:  boolean;
  saving:   boolean;
}>();

const emit = defineEmits<{
  save: [data: { auth: AuthFormData }];
}>();

const authTypeOptions = [
  { label: 'Basic (Username/Password)', value: 'basic' },
  { label: 'API Key', value: 'api_key' },
  { label: 'Reverse Proxy', value: 'proxy' },
];

const form = reactive<AuthFormData>({
  enabled:  false,
  type:     'basic',
  username: '',
  password: undefined,
  api_key:  undefined,
});

watch(
  () => props.settings?.auth,
  (next) => {
    if (!next) {
      return;
    }

    form.enabled = next.enabled;
    form.type = next.type;
    form.username = next.username ?? '';
    // Don't set secrets, keep undefined so we know user hasn't touched them
    form.password = undefined;
    form.api_key = undefined;
  },
  { immediate: true }
);

const passwordConfigured = computed(
  () => props.settings?.auth?.password?.configured ?? false
);

const apiKeyConfigured = computed(
  () => props.settings?.auth?.api_key?.configured ?? false
);

const showBasicFields = computed(() => form.type === 'basic');
const showApiKeyField = computed(() => form.type === 'api_key');
const showProxyInfo = computed(() => form.type === 'proxy');

function handleSave() {
  const data: AuthFormData = {
    enabled: form.enabled,
    type:    form.type,
  };

  if (form.type === 'basic') {
    if (form.username?.trim()) {
      data.username = form.username.trim();
    }

    if (form.password?.trim()) {
      data.password = form.password.trim();
    }
  }

  if (form.type === 'api_key' && form.api_key?.trim()) {
    data.api_key = form.api_key.trim();
  }

  emit('save', { auth: data });
}
</script>

<template>
  <div class="settings-form">
    <Message severity="warn" :closable="false" class="mb-4">
      <template #icon>
        <i class="pi pi-exclamation-triangle" />
      </template>
      <strong>Warning:</strong> If you lock yourself out, you can reset authentication
      by editing the config file directly at <code>/config/config.yaml</code> and
      setting <code>ui.auth.enabled: false</code>.
    </Message>

    <div class="settings-form__grid">
      <label class="settings-form__field">
        <span class="settings-form__label">Authentication Enabled</span>
        <ToggleSwitch v-model="form.enabled" :disabled="loading" />
      </label>

      <label class="settings-form__field">
        <span class="settings-form__label">Authentication Type</span>
        <Select
          v-model="form.type"
          :options="authTypeOptions"
          option-label="label"
          option-value="value"
          :disabled="loading || !form.enabled"
        />
      </label>
    </div>

    <div v-if="showBasicFields && form.enabled" class="settings-form__grid mt-4">
      <label class="settings-form__field">
        <span class="settings-form__label">Username</span>
        <InputText
          v-model="form.username"
          :disabled="loading"
          placeholder="admin"
        />
      </label>

      <label class="settings-form__field">
        <span class="settings-form__label">
          Password
          <Tag
            v-if="passwordConfigured"
            severity="success"
            value="Configured"
            class="ml-2"
          />
        </span>
        <InputText
          v-model="form.password"
          type="password"
          :disabled="loading"
          :placeholder="passwordConfigured ? 'Enter to change' : 'Password'"
        />
      </label>
    </div>

    <div v-if="showApiKeyField && form.enabled" class="settings-form__grid mt-4">
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
        <span class="settings-form__help">
          Sent via <code>X-API-Key</code> header or <code>api_key</code> query parameter.
        </span>
      </label>
    </div>

    <div v-if="showProxyInfo && form.enabled" class="settings-form__info mt-4">
      <Message severity="info" :closable="false">
        Reverse proxy authentication trusts your proxy to handle authentication.
        Make sure your reverse proxy (nginx, Traefik, etc.) is properly configured
        to protect all routes.
      </Message>
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

.settings-form__help code {
  background: var(--surface-700);
  padding: 0.125rem 0.25rem;
  border-radius: 0.25rem;
  font-size: 0.75rem;
}

.settings-form__info {
  margin-top: 1rem;
}

.settings-form__actions {
  margin-top: 1.5rem;
  display: flex;
  justify-content: flex-end;
}

.mb-4 {
  margin-bottom: 1rem;
}

.mt-4 {
  margin-top: 1rem;
}
</style>
