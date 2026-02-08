<script setup lang="ts">
import type {
  ListenBrainzFormData,
  CatalogDiscoveryFormData,
  SlskdFormData,
  PreviewFormData,
  AuthFormData,
  UIPreferences,
} from '@/types/settings';
import type { SettingsTab } from '@/types/tabs';

import { onMounted } from 'vue';

import { useTabSync } from '@/composables/useTabSync';
import { useSettings } from '@/composables/useSettings';
import { SETTINGS_TABS } from '@/types/tabs';

import Tabs from 'primevue/tabs';
import TabList from 'primevue/tablist';
import Tab from 'primevue/tab';
import TabPanels from 'primevue/tabpanels';
import TabPanel from 'primevue/tabpanel';

import LoadingSpinner from '@/components/common/LoadingSpinner.vue';
import ListenBrainzForm from '@/components/settings/ListenBrainzForm.vue';
import CatalogDiscoveryForm from '@/components/settings/CatalogDiscoveryForm.vue';
import SlskdForm from '@/components/settings/SlskdForm.vue';
import PreviewForm from '@/components/settings/PreviewForm.vue';
import AuthForm from '@/components/settings/AuthForm.vue';
import UIPreferencesForm from '@/components/settings/UIPreferencesForm.vue';

import '@/assets/styles/settings-forms.css';

const { activeTab } = useTabSync<SettingsTab>({
  validTabs:  SETTINGS_TABS,
  defaultTab: 'listenbrainz',
});

const {
  loading,
  saving,
  listenbrainz,
  slskd,
  catalogDiscovery,
  preview,
  ui,
  uiPreferences,
  fetchSettings,
  updateSection,
  saveUIPreferences,
} = useSettings();

onMounted(() => {
  fetchSettings();
});

async function handleListenBrainzSave(data: ListenBrainzFormData) {
  await updateSection('listenbrainz', data);
}

async function handleCatalogDiscoverySave(data: CatalogDiscoveryFormData) {
  await updateSection('catalog_discovery', data);
}

async function handleSlskdSave(data: SlskdFormData) {
  await updateSection('slskd', data);
}

async function handlePreviewSave(data: PreviewFormData) {
  await updateSection('preview', data);
}

async function handleAuthSave(data: { auth: AuthFormData }) {
  await updateSection('ui', data);
}

function handleUIPreferencesSave(prefs: Partial<UIPreferences>) {
  saveUIPreferences(prefs);
}
</script>

<template>
  <div class="settings-page">
    <header class="settings-page__header">
      <div>
        <h1 class="settings-page__title">Settings</h1>
        <p class="settings-page__subtitle">
          Configure your DeepCrate discovery pipeline preferences.
        </p>
      </div>
    </header>

    <LoadingSpinner v-if="loading && !listenbrainz && !catalogDiscovery" />

    <div v-else class="settings-page__content">
      <Tabs v-model:value="activeTab">
        <TabList>
          <Tab value="listenbrainz">ListenBrainz</Tab>
          <Tab value="catalog">Catalog Discovery</Tab>
          <Tab value="slskd">slskd</Tab>
          <Tab value="preview">Preview</Tab>
          <Tab value="auth">Authentication</Tab>
          <Tab value="ui">UI Preferences</Tab>
        </TabList>
        <TabPanels>
          <TabPanel value="listenbrainz">
            <div class="settings-page__panel">
              <h2 class="settings-page__section-title">ListenBrainz</h2>
              <p class="settings-page__section-desc">
                Configure ListenBrainz integration for music recommendations.
              </p>
              <ListenBrainzForm
                :settings="listenbrainz"
                :loading="loading"
                :saving="saving"
                @save="handleListenBrainzSave"
              />
            </div>
          </TabPanel>

          <TabPanel value="catalog">
            <div class="settings-page__panel">
              <h2 class="settings-page__section-title">Catalog Discovery</h2>
              <p class="settings-page__section-desc">
                Find similar artists based on your Subsonic server library using Last.fm.
              </p>
              <CatalogDiscoveryForm
                :settings="catalogDiscovery"
                :loading="loading"
                :saving="saving"
                @save="handleCatalogDiscoverySave"
              />
            </div>
          </TabPanel>

          <TabPanel value="slskd">
            <div class="settings-page__panel">
              <h2 class="settings-page__section-title">slskd Connection</h2>
              <p class="settings-page__section-desc">
                Configure your slskd Soulseek client connection and search preferences.
              </p>
              <SlskdForm
                :settings="slskd"
                :loading="loading"
                :saving="saving"
                @save="handleSlskdSave"
              />
            </div>
          </TabPanel>

          <TabPanel value="preview">
            <div class="settings-page__panel">
              <h2 class="settings-page__section-title">Audio Preview</h2>
              <p class="settings-page__section-desc">
                Configure Spotify integration for audio previews in the queue.
              </p>
              <PreviewForm
                :settings="preview"
                :loading="loading"
                :saving="saving"
                @save="handlePreviewSave"
              />
            </div>
          </TabPanel>

          <TabPanel value="auth">
            <div class="settings-page__panel">
              <h2 class="settings-page__section-title">Authentication</h2>
              <p class="settings-page__section-desc">
                Configure how users authenticate to access DeepCrate.
              </p>
              <AuthForm
                :settings="ui"
                :loading="loading"
                :saving="saving"
                @save="handleAuthSave"
              />
            </div>
          </TabPanel>

          <TabPanel value="ui">
            <div class="settings-page__panel">
              <h2 class="settings-page__section-title">UI Preferences</h2>
              <p class="settings-page__section-desc">
                Customize the look and feel of the DeepCrate interface.
              </p>
              <UIPreferencesForm
                :preferences="uiPreferences"
                @save="handleUIPreferencesSave"
              />
            </div>
          </TabPanel>
        </TabPanels>
      </Tabs>
    </div>
  </div>
</template>

<style scoped>
.settings-page {
  max-width: 1200px;
  margin: 0 auto;
}

.settings-page__header {
  margin-bottom: 2rem;
}

.settings-page__title {
  font-size: 2.25rem;
  font-weight: 700;
  color: var(--r-text-primary);
  margin: 0;
}

.settings-page__subtitle {
  font-size: 1rem;
  color: var(--surface-300);
  margin: 0.5rem 0 0 0;
}

.settings-page__content {
  background: var(--surface-glass, rgba(21, 21, 37, 0.7));
  border: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.08));
  border-radius: 1rem;
  overflow: hidden;
}

.settings-page__panel {
  padding: 1.5rem;
}

.settings-page__section-title {
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--r-text-primary);
  margin: 0 0 0.5rem 0;
}

.settings-page__section-desc {
  font-size: 0.875rem;
  color: var(--surface-300);
  margin: 0 0 1.5rem 0;
}

:deep(.p-tablist) {
  background: var(--surface-800);
  border-bottom: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.08));
}

:deep(.p-tab) {
  background: transparent;
  border: none;
  color: var(--surface-300);
  padding: 1rem 1.5rem;
  font-weight: 600;
}

:deep(.p-tab[data-p-active="true"]) {
  color: var(--primary-color);
  border-bottom: 2px solid var(--primary-color);
}

:deep(.p-tab:not([data-p-active="true"]):hover) {
  color: var(--r-text-primary);
  background: var(--r-hover-bg);
}

:deep(.p-tabpanels) {
  background: transparent;
}
</style>
