<script setup lang="ts">
import { onMounted } from 'vue';
import { useDownloads } from '@/composables/useDownloads';
import { useDownloadsSocket } from '@/composables/useDownloadsSocket';
import { useJobs } from '@/composables/useJobs';
import { JOB_NAMES } from '@/constants/jobs';

import Tabs from 'primevue/tabs';
import TabList from 'primevue/tablist';
import Tab from 'primevue/tab';
import TabPanels from 'primevue/tabpanels';
import TabPanel from 'primevue/tabpanel';
import Button from 'primevue/button';

import DownloadStats from '@/components/downloads/DownloadStats.vue';
import ErrorMessage from '@/components/common/ErrorMessage.vue';
import ActiveDownloadsList from '@/components/downloads/ActiveDownloadsList.vue';
import CompletedDownloadsList from '@/components/downloads/CompletedDownloadsList.vue';
import FailedDownloadsList from '@/components/downloads/FailedDownloadsList.vue';

/*
  TODO: Add "Queued" downloads tab, will require a new API endpoint.
*/

const {
  activeDownloads,
  completedDownloads,
  failedDownloads,
  stats,
  loading,
  error,
  fetchActive,
  fetchCompleted,
  fetchFailed,
  fetchStats,
  retryFailed,
  deleteDownloads,
} = useDownloads();

useDownloadsSocket();

const {
  triggeringJob,
  triggerDownloader
} = useJobs();

const loadData = async() => {
  await Promise.all([
    fetchActive(),
    fetchCompleted(),
    fetchFailed(),
    fetchStats(),
  ]);
};

const handleRefresh = async() => {
  await loadData();
};

const handleRetry = async(ids: string[]) => {
  await retryFailed(ids);
  // Refresh failed downloads list after retry
  await fetchFailed();
};

const handleDelete = async(ids: string[]) => {
  await deleteDownloads(ids);
};

const handleTriggerDownloader = async() => {
  try {
    await triggerDownloader();
  } catch {
    // Error is already handled in the store
  }
};

onMounted(() => {
  loadData();
});
</script>

<template>
  <div class="downloads-page">
    <header class="downloads-page__header">
      <div>
        <h1 class="downloads-page__title">Downloads</h1>
        <p class="downloads-page__subtitle">
          Monitor and manage your download queue.
        </p>
      </div>
      <div class="flex gap-4">
        <Button
          label="Process Downloads"
          icon="pi pi-download"
          :loading="triggeringJob === JOB_NAMES.SLSKD"
          @click="handleTriggerDownloader"
          outlined
        />
        <Button
          label="Refresh"
          icon="pi pi-refresh"
          @click="handleRefresh"
          :loading="loading"
        />
      </div>
    </header>

    <ErrorMessage
      :error="error"
      :loading="loading"
      @retry="loadData"
    />

    <DownloadStats :stats="stats" />

    <Tabs class="downloads-page__tabs" value="active">
      <TabList>
        <Tab value="active">Active</Tab>
        <Tab value="completed">Completed</Tab>
        <Tab value="failed">Failed</Tab>
      </TabList>
      <TabPanels>
        <TabPanel value="active">
          <ActiveDownloadsList
            :downloads="activeDownloads"
            :loading="loading"
            @delete="handleDelete"
          />
        </TabPanel>

        <TabPanel value="completed">
          <CompletedDownloadsList
            :downloads="completedDownloads"
            :loading="loading"
            @delete="handleDelete"
          />
        </TabPanel>

        <TabPanel value="failed">
          <FailedDownloadsList
            :downloads="failedDownloads"
            :loading="loading"
            @retry="handleRetry"
            @delete="handleDelete"
          />
        </TabPanel>
      </TabPanels>
    </Tabs>
  </div>
</template>

<style scoped>
.downloads-page {
  max-width: 1400px;
  margin: 0 auto;
  padding: 2rem;
}

.downloads-page__header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 2rem;
}

.downloads-page__title {
  font-size: 2.25rem;
  font-weight: 700;
  color: var(--r-text-primary);
  margin: 0;
}

.downloads-page__subtitle {
  font-size: 1rem;
  color: var(--surface-300);
  margin: 0.5rem 0 0 0;
}

.downloads-page__tabs {
  margin-top: 2rem;
}

.badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 1.5rem;
  height: 1.5rem;
  padding: 0 0.5rem;
  border-radius: 0.75rem;
  font-size: 0.75rem;
  font-weight: 600;
}

.badge--primary {
  background: var(--primary-500);
  color: var(--r-text-primary);
}

.badge--success {
  background: var(--green-500);
  color: var(--r-text-primary);
}

.badge--danger {
  background: var(--red-500);
  color: var(--r-text-primary);
}

@media (max-width: 768px) {
  .downloads-page {
    padding: 1rem;
  }

  .downloads-page__header {
    flex-direction: column;
    gap: 1rem;
  }

  .downloads-page__title {
    font-size: 1.75rem;
  }
}
</style>
