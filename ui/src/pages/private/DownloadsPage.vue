<script setup lang="ts">
import type { ActiveDownload } from '@/types';
import type { DownloadsTab } from '@/types';

import { onMounted } from 'vue';

import { useTabSync } from '@/composables/useTabSync';
import { DOWNLOADS_TABS } from '@/constants/settings';
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
import SearchResultsModal from '@/components/downloads/SearchResultsModal.vue';

/*
  TODO: Add "Queued" downloads tab, will require a new API endpoint.
*/

const { activeTab } = useTabSync<DownloadsTab>({
  validTabs:  DOWNLOADS_TABS,
  defaultTab: 'active',
});

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
  selectedTaskId,
  selectionModalVisible,
  selectionLoading,
  openSelectionModal,
  closeSelectionModal,
  selectResult,
  skipResult,
  retrySearchForTask,
  autoSelectForTask,
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

const handleSelectDownload = (download: ActiveDownload) => {
  openSelectionModal(download.id);
};

const handleModalSelect = async(taskId: string, username: string, directory?: string) => {
  await selectResult(taskId, username, directory);
};

const handleModalSkip = async(taskId: string, username: string) => {
  await skipResult(taskId, username);
};

const handleModalRetrySearch = async(taskId: string, query?: string) => {
  await retrySearchForTask(taskId, query);
};

const handleModalAutoSelect = async(taskId: string) => {
  await autoSelectForTask(taskId);
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

    <DownloadStats :loading="loading" :stats="stats" />

    <Tabs class="downloads-page__tabs" v-model:value="activeTab">
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
            @select="handleSelectDownload"
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

    <SearchResultsModal
      :visible="selectionModalVisible"
      :task-id="selectedTaskId"
      :loading="selectionLoading"
      @update:visible="closeSelectionModal"
      @select="handleModalSelect"
      @skip="handleModalSkip"
      @retry-search="handleModalRetrySearch"
      @auto-select="handleModalAutoSelect"
    />
  </div>
</template>

<style lang="scss" scoped>
.downloads-page {
  max-width: 1400px;
  margin: 0 auto;

  &__header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 2rem;

    @media (max-width: 768px) {
      flex-direction: column;
      gap: 1rem;
    }
  }

  &__title {
    font-size: 2.25rem;
    font-weight: 700;
    color: var(--r-text-primary);
    margin: 0;

    @media (max-width: 768px) {
      font-size: 1.75rem;
    }
  }

  &__subtitle {
    font-size: 1rem;
    color: var(--surface-300);
    margin: 0.5rem 0 0 0;
  }

  &__tabs {
    margin-top: 2rem;
  }
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

  &--primary {
    background: var(--primary-500);
    color: var(--r-text-primary);
  }

  &--success {
    background: var(--green-500);
    color: var(--r-text-primary);
  }

  &--danger {
    background: var(--red-500);
    color: var(--r-text-primary);
  }
}
</style>
