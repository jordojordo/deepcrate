<script setup lang="ts">
import type { UISettings, AuthFormData } from '@/types';

import { reactive, ref, watch, computed } from 'vue';
import { useSettings } from '@/composables/useSettings';

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

const { validateSection } = useSettings();

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

const errors = ref<Array<{ path: string; message: string }>>([]);

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

async function handleSave() {
  errors.value = [];

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

  const validation = await validateSection('ui', { auth: data });

  if (!validation.valid && validation.errors) {
    errors.value = validation.errors;

    return;
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
        <label for="setting-auth-enabled" class="settings-form__label">
          Authentication Enabled
        </label>
        <ToggleSwitch
          id="setting-auth-enabled"
          v-model="form.enabled"
          :disabled="loading"
        />
      </div>

      <div class="settings-form__field">
        <label for="setting-auth-type" class="settings-form__label">
          Authentication Type
        </label>
        <Select
          id="setting-auth-type"
          v-model="form.type"
          :options="authTypeOptions"
          option-label="label"
          option-value="value"
          :disabled="loading || !form.enabled"
        />
      </div>
    </div>

    <div v-if="showBasicFields && form.enabled" class="settings-form__grid mt-4">
      <div class="settings-form__field">
        <label for="setting-auth-username" class="settings-form__label">Username</label>
        <InputText
          id="setting-auth-username"
          v-model="form.username"
          :disabled="loading"
          placeholder="admin"
        />
      </div>

      <div class="settings-form__field">
        <label for="setting-auth-password" class="settings-form__label">
          Password
          <Tag
            v-if="passwordConfigured"
            severity="success"
            value="Configured"
            class="ml-2"
          />
        </label>
        <InputText
          id="setting-auth-password"
          v-model="form.password"
          type="password"
          :disabled="loading"
          :placeholder="passwordConfigured ? 'Enter to change' : 'Password'"
        />
      </div>
    </div>

    <div v-if="showApiKeyField && form.enabled" class="settings-form__grid mt-4">
      <div class="settings-form__field">
        <label for="setting-auth-api-key" class="settings-form__label">
          API Key
          <Tag
            v-if="apiKeyConfigured"
            severity="success"
            value="Configured"
            class="ml-2"
          />
        </label>
        <InputText
          id="setting-auth-api-key"
          v-model="form.api_key"
          type="password"
          :disabled="loading"
          :placeholder="apiKeyConfigured ? 'Enter to change' : 'API key'"
        />
        <span class="settings-form__help">
          Sent via <code>X-API-Key</code> header or <code>api_key</code> query parameter.
        </span>
      </div>
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
