<script setup lang="ts">
import type { LibraryOrganizeConfig } from '@/types';

import { computed, onMounted } from 'vue';
import { useLibrary } from '@/composables/useLibrary';
import { useJobsSocket } from '@/composables/useJobsSocket';
import { useJobsStore } from '@/stores/jobs';
import { JOB_NAMES } from '@/constants/jobs';

import Tabs from 'primevue/tabs';
import TabList from 'primevue/tablist';
import Tab from 'primevue/tab';
import TabPanels from 'primevue/tabpanels';
import TabPanel from 'primevue/tabpanel';
import Button from 'primevue/button';

import LibraryStats from '@/components/library/LibraryStats.vue';
import ErrorMessage from '@/components/common/ErrorMessage.vue';
import LibraryOrganizeActions from '@/components/library/LibraryOrganizeActions.vue';
import UnorganizedTasksList from '@/components/library/UnorganizedTasksList.vue';
import LibraryConfigForm from '@/components/library/LibraryConfigForm.vue';

const jobsStore = useJobsStore();

const {
  status,
  config,
  unorganizedTasks,
  unorganizedTotal,
  loading,
  configLoading,
  savingConfig,
  organizing,
  organizeProgress,
  hasMoreUnorganized,
  error,
  fetchStatus,
  fetchConfig,
  fetchUnorganizedTasks,
  loadMoreUnorganized,
  updateConfig,
  triggerOrganize,
} = useLibrary();

useJobsSocket();

const organizeJobRunning = computed(() => {
  const job = jobsStore.jobs.find((j) => j.name === JOB_NAMES.LIBRARY_ORGANIZE);

  return Boolean(job?.running);
});

const loadData = async() => {
  await Promise.all([
    jobsStore.fetchStatus(),
    fetchStatus(),
    fetchConfig(),
    fetchUnorganizedTasks(false),
  ]);
};

const handleRefresh = async() => {
  await loadData();
};

const handleTrigger = async() => {
  await triggerOrganize();
  await jobsStore.fetchStatus();
};

const handleCancel = async() => {
  await jobsStore.cancel(JOB_NAMES.LIBRARY_ORGANIZE);
};

const handleSaveConfig = async(nextConfig: LibraryOrganizeConfig) => {
  await updateConfig(nextConfig);
};

onMounted(() => {
  loadData();
});
</script>

<template>
  <div class="library-page">
    <header class="library-page__header">
      <div>
        <h1 class="library-page__title">Library</h1>
        <p class="library-page__subtitle">
          Configure and run library organization.
        </p>
      </div>
      <Button
        label="Refresh"
        icon="pi pi-refresh"
        @click="handleRefresh"
        :loading="loading || configLoading"
      />
    </header>

    <ErrorMessage
      :error="error"
      :loading="loading"
      @retry="loadData"
    />

    <LibraryStats :status="status" />

    <LibraryOrganizeActions
      :status="status"
      :progress="organizeProgress"
      :running="organizeJobRunning || organizing"
      :trigger-loading="organizing"
      :cancel-loading="jobsStore.cancellingJob === JOB_NAMES.LIBRARY_ORGANIZE"
      :on-trigger="handleTrigger"
      :on-cancel="handleCancel"
    />

    <Tabs class="library-page__tabs" value="unorganized">
      <TabList>
        <Tab value="unorganized">Unorganized</Tab>
        <Tab value="configuration">Configuration</Tab>
      </TabList>
      <TabPanels>
        <TabPanel value="unorganized">
          <UnorganizedTasksList
            :tasks="unorganizedTasks"
            :total="unorganizedTotal"
            :loading="loading"
            :has-more="hasMoreUnorganized"
            @load-more="loadMoreUnorganized"
          />
        </TabPanel>

        <TabPanel value="configuration">
          <LibraryConfigForm
            :config="config"
            :loading="configLoading"
            :saving="savingConfig"
            @save="handleSaveConfig"
          />
        </TabPanel>
      </TabPanels>
    </Tabs>
  </div>
</template>

<style scoped>
.library-page {
  max-width: 1400px;
  margin: 0 auto;
  padding: 2rem;
}

.library-page__header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 2rem;
}

.library-page__title {
  font-size: 2.25rem;
  font-weight: 700;
  color: var(--r-text-primary);
  margin: 0;
}

.library-page__subtitle {
  font-size: 1rem;
  color: var(--surface-300);
  margin: 0.5rem 0 0 0;
}

.library-page__tabs {
  margin-top: 2rem;
}
</style>
