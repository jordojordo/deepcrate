<script setup lang="ts">
import type { WebhookConfig, WebhookEvent } from '@/types';
import type { WebhookTestResult } from '@/services/webhooks';

import { reactive, watch, ref } from 'vue';
import { testWebhook } from '@/services/webhooks';
import { useToast } from '@/composables/useToast';

import Button from 'primevue/button';
import InputText from 'primevue/inputtext';
import InputNumber from 'primevue/inputnumber';
import ToggleSwitch from 'primevue/toggleswitch';
import MultiSelect from 'primevue/multiselect';
import Password from 'primevue/password';

const props = defineProps<{
  settings: WebhookConfig[] | undefined;
  loading:  boolean;
  saving:   boolean;
}>();

const emit = defineEmits<{
  save: [data: WebhookConfig[]];
}>();

const { showSuccess, showError } = useToast();

interface WebhookFormItem {
  name:       string;
  enabled:    boolean;
  url:        string;
  secret:     string;
  events:     WebhookEvent[];
  timeout_ms: number;
  retry:      number;
}

const webhooks = reactive<WebhookFormItem[]>([]);
const testResults = ref<Record<number, WebhookTestResult>>({});
const testing = ref<Record<number, boolean>>({});

const eventOptions = [
  { label: 'Download Completed', value: 'download_completed' as WebhookEvent },
  { label: 'Queue Approved',     value: 'queue_approved' as WebhookEvent },
  { label: 'Queue Rejected',     value: 'queue_rejected' as WebhookEvent },
];

watch(
  () => props.settings,
  (next) => {
    webhooks.length = 0;

    if (next) {
      webhooks.push(...next.map((w) => ({
        name:       w.name,
        enabled:    w.enabled,
        url:        w.url,
        secret:     '',
        events:     [...w.events],
        timeout_ms: w.timeout_ms,
        retry:      w.retry,
      })));
    }
  },
  { immediate: true }
);

function addWebhook() {
  webhooks.push({
    name:       '',
    enabled:    true,
    url:        '',
    secret:     '',
    events:     ['download_completed'],
    timeout_ms: 10000,
    retry:      0,
  });
}

function removeWebhook(index: number) {
  webhooks.splice(index, 1);
  delete testResults.value[index];
  delete testing.value[index];
}

async function handleTest(index: number, dryRun = false) {
  const webhook = webhooks[index];

  if (!webhook.url) {
    showError('Webhook URL is required to test');

    return;
  }

  testing.value[index] = true;
  delete testResults.value[index];

  try {
    const result = await testWebhook({
      url:        webhook.url,
      secret:     webhook.secret || undefined,
      timeout_ms: webhook.timeout_ms,
      dry_run:    dryRun,
    });

    testResults.value[index] = result;

    if (result.dry_run) {
      showSuccess('Dry run payload preview generated');
    } else if (result.success) {
      showSuccess(`Webhook "${ webhook.name || 'test' }" responded successfully (${ result.statusCode })`);
    } else {
      showError(`Webhook failed: ${ result.error || `status ${ result.statusCode }` }`);
    }
  } catch(err) {
    showError(`Failed to test webhook: ${ err instanceof Error ? err.message : 'Unknown error' }`);
  } finally {
    testing.value[index] = false;
  }
}

function handleSave() {
  const data: WebhookConfig[] = webhooks.map((w) => {
    const config: WebhookConfig = {
      name:       w.name,
      enabled:    w.enabled,
      url:        w.url,
      events:     w.events,
      timeout_ms: w.timeout_ms,
      retry:      w.retry,
    };

    if (w.secret) {
      config.secret = w.secret;
    }

    return config;
  });

  emit('save', data);
}
</script>

<template>
  <div class="settings-form">
    <div v-if="webhooks.length === 0" class="webhooks-empty">
      <p class="settings-form__help">
        No webhooks configured. Add a webhook to receive HTTP notifications on events like downloads and queue changes.
      </p>
    </div>

    <div
      v-for="(webhook, index) in webhooks"
      :key="index"
      class="webhook-card"
    >
      <div class="webhook-card__header">
        <span class="webhook-card__title">
          {{ webhook.name || 'New Webhook' }}
        </span>
        <Button
          icon="pi pi-trash"
          severity="danger"
          text
          size="small"
          @click="removeWebhook(index)"
        />
      </div>

      <div class="settings-form__grid">
        <div class="settings-form__field">
          <label :for="`webhook-name-${index}`" class="settings-form__label">Name</label>
          <InputText
            :id="`webhook-name-${index}`"
            v-model="webhook.name"
            :disabled="loading"
            placeholder="my-webhook"
          />
        </div>

        <div class="settings-form__field">
          <label :for="`webhook-enabled-${index}`" class="settings-form__label">Enabled</label>
          <ToggleSwitch
            :id="`webhook-enabled-${index}`"
            v-model="webhook.enabled"
            :disabled="loading"
          />
        </div>

        <div class="settings-form__field settings-form__field--full">
          <label :for="`webhook-url-${index}`" class="settings-form__label">URL</label>
          <InputText
            :id="`webhook-url-${index}`"
            v-model="webhook.url"
            :disabled="loading"
            placeholder="https://example.com/webhook"
          />
        </div>

        <div class="settings-form__field settings-form__field--full">
          <label :for="`webhook-secret-${index}`" class="settings-form__label">Secret</label>
          <Password
            :id="`webhook-secret-${index}`"
            v-model="webhook.secret"
            :disabled="loading"
            :feedback="false"
            placeholder="Optional signing secret"
            toggle-mask
          />
          <span class="settings-form__help">
            Used to sign payloads with HMAC-SHA256 (sent as X-Webhook-Signature header).
          </span>
        </div>

        <div class="settings-form__field settings-form__field--full">
          <label :for="`webhook-events-${index}`" class="settings-form__label">Events</label>
          <MultiSelect
            :id="`webhook-events-${index}`"
            v-model="webhook.events"
            :options="eventOptions"
            option-label="label"
            option-value="value"
            :disabled="loading"
            placeholder="Select events"
          />
        </div>

        <div class="settings-form__field">
          <label :for="`webhook-timeout-${index}`" class="settings-form__label">Timeout (ms)</label>
          <InputNumber
            :id="`webhook-timeout-${index}`"
            v-model="webhook.timeout_ms"
            :disabled="loading"
            :min="1000"
            :max="30000"
          />
        </div>

        <div class="settings-form__field">
          <label :for="`webhook-retry-${index}`" class="settings-form__label">Retries</label>
          <InputNumber
            :id="`webhook-retry-${index}`"
            v-model="webhook.retry"
            :disabled="loading"
            :min="0"
            :max="5"
          />
        </div>
      </div>

      <div class="webhook-card__actions">
        <Button
          label="Test"
          icon="pi pi-play"
          severity="secondary"
          size="small"
          :loading="testing[index]"
          :disabled="loading || !webhook.url"
          @click="handleTest(index)"
        />
        <Button
          label="Dry Run"
          icon="pi pi-eye"
          severity="secondary"
          size="small"
          outlined
          :loading="testing[index]"
          :disabled="loading || !webhook.url"
          @click="handleTest(index, true)"
        />
      </div>

      <div v-if="testResults[index]" class="webhook-test-output">
        <div
          class="webhook-test-output__status"
          :class="testResults[index].success ? 'webhook-test-output__status--success' : 'webhook-test-output__status--error'"
        >
          {{ testResults[index].dry_run ? 'Dry Run' : testResults[index].success ? 'Success' : 'Failed' }}
          <span v-if="!testResults[index].dry_run" class="webhook-test-output__meta">
            ({{ testResults[index].statusCode ?? 'no response' }}, {{ testResults[index].duration }}ms)
          </span>
        </div>
        <pre v-if="testResults[index].payload" class="webhook-test-output__pre">{{ JSON.stringify(testResults[index].payload, null, 2) }}</pre>
        <pre v-if="testResults[index].error" class="webhook-test-output__pre webhook-test-output__pre--error">{{ testResults[index].error }}</pre>
      </div>
    </div>

    <div class="settings-form__actions">
      <Button
        label="Add Webhook"
        icon="pi pi-plus"
        severity="secondary"
        :disabled="loading"
        @click="addWebhook"
      />
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

<style lang="scss" scoped>
.webhooks-empty {
  padding: 1rem 0;
}

.webhook-card {
  border: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.08));
  border-radius: 0.5rem;
  padding: 1rem;
  margin-bottom: 1rem;
  background: var(--surface-900, rgba(0, 0, 0, 0.2));

  &__header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.75rem;
  }

  &__title {
    font-weight: 600;
    color: var(--r-text-primary);
  }

  &__actions {
    margin-top: 0.75rem;
  }
}

.webhook-test-output {
  margin-top: 0.75rem;
  border: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.08));
  border-radius: 0.375rem;
  padding: 0.5rem;
  background: var(--surface-950, rgba(0, 0, 0, 0.3));

  &__status {
    font-size: 0.8125rem;
    font-weight: 600;
    margin-bottom: 0.25rem;

    &--success {
      color: var(--green-400);
    }

    &--error {
      color: var(--red-400);
    }
  }

  &__meta {
    font-weight: 400;
    color: var(--surface-300);
  }

  &__pre {
    font-size: 0.75rem;
    margin: 0.25rem 0 0;
    padding: 0.5rem;
    background: var(--surface-900);
    border-radius: 0.25rem;
    overflow-x: auto;
    white-space: pre-wrap;
    word-break: break-word;
    max-height: 200px;
    overflow-y: auto;
    color: var(--surface-200);

    &--error {
      color: var(--red-300);
    }
  }
}
</style>
