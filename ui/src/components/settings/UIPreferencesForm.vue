<script setup lang="ts">
import type { UIPreferences } from '@/types/settings';

import { reactive, watch } from 'vue';

import Button from 'primevue/button';
import Select from 'primevue/select';
import InputNumber from 'primevue/inputnumber';
import ToggleSwitch from 'primevue/toggleswitch';
import Message from 'primevue/message';

const props = defineProps<{
  preferences: UIPreferences;
}>();

const emit = defineEmits<{
  save: [prefs: Partial<UIPreferences>];
}>();

const themeOptions = [
  { label: 'Dark', value: 'dark' },
  { label: 'Light', value: 'light' },
  { label: 'System', value: 'system' },
];

const viewModeOptions = [
  { label: 'Grid', value: 'grid' },
  { label: 'List', value: 'list' },
];

const form = reactive<UIPreferences>({
  theme:            'dark',
  queueViewMode:    'grid',
  sidebarCollapsed: false,
  itemsPerPage:     25,
});

watch(
  () => props.preferences,
  (next) => {
    Object.assign(form, next);
  },
  { immediate: true }
);

function handleSave() {
  emit('save', { ...form });
}
</script>

<template>
  <div class="settings-form">
    <Message severity="info" :closable="false" class="mb-4">
      <template #icon>
        <i class="pi pi-info-circle" />
      </template>
      UI preferences are stored locally in your browser and don't sync across devices.
    </Message>

    <div class="settings-form__grid">
      <label class="settings-form__field">
        <span class="settings-form__label">Theme</span>
        <Select
          v-model="form.theme"
          :options="themeOptions"
          option-label="label"
          option-value="value"
        />
        <span class="settings-form__help">
          System will follow your OS preference.
        </span>
      </label>

      <label class="settings-form__field">
        <span class="settings-form__label">Default Queue View</span>
        <Select
          v-model="form.queueViewMode"
          :options="viewModeOptions"
          option-label="label"
          option-value="value"
        />
      </label>

      <label class="settings-form__field">
        <span class="settings-form__label">Items Per Page</span>
        <InputNumber
          v-model="form.itemsPerPage"
          :min="10"
          :max="100"
          :step="5"
        />
      </label>

      <label class="settings-form__field">
        <span class="settings-form__label">Sidebar Collapsed by Default</span>
        <ToggleSwitch v-model="form.sidebarCollapsed" />
      </label>
    </div>

    <div class="settings-form__actions">
      <Button
        label="Save Preferences"
        icon="pi pi-save"
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
}

.settings-form__help {
  color: var(--surface-400);
  font-size: 0.75rem;
}

.settings-form__actions {
  margin-top: 1.5rem;
  display: flex;
  justify-content: flex-end;
}

.mb-4 {
  margin-bottom: 1rem;
}
</style>
