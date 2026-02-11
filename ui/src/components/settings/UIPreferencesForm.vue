<script setup lang="ts">
import type { UIPreferences } from '@/types';

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
  wishlistViewMode: 'grid',
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
      <div class="settings-form__field">
        <label for="setting-ui-theme" class="settings-form__label">Theme</label>
        <Select
          id="setting-ui-theme"
          v-model="form.theme"
          :options="themeOptions"
          option-label="label"
          option-value="value"
        />
        <span class="settings-form__help">
          System will follow your OS preference.
        </span>
      </div>

      <div class="settings-form__field">
        <label for="setting-ui-queue-view" class="settings-form__label">
          Default Queue View
        </label>
        <Select
          id="setting-ui-queue-view"
          v-model="form.queueViewMode"
          :options="viewModeOptions"
          option-label="label"
          option-value="value"
        />
      </div>

      <div class="settings-form__field">
        <label for="setting-ui-wishlist-view" class="settings-form__label">
          Default Wishlist View
        </label>
        <Select
          id="setting-ui-wishlist-view"
          v-model="form.wishlistViewMode"
          :options="viewModeOptions"
          option-label="label"
          option-value="value"
        />
      </div>

      <div class="settings-form__field">
        <label for="setting-ui-items-per-page" class="settings-form__label">
          Items Per Page
        </label>
        <InputNumber
          id="setting-ui-items-per-page"
          v-model="form.itemsPerPage"
          :min="10"
          :max="100"
          :step="5"
        />
      </div>

      <div class="settings-form__field">
        <label for="setting-ui-sidebar-collapsed" class="settings-form__label">
          Sidebar Collapsed by Default
        </label>
        <ToggleSwitch
          id="setting-ui-sidebar-collapsed"
          v-model="form.sidebarCollapsed"
        />
      </div>
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
