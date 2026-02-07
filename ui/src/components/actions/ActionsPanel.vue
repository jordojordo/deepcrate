<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { JOB_NAMES } from '@/constants/jobs';
import { useJobs } from '@/composables/useJobs';
import { formatRelativeTime, formatFutureRelativeTime } from '@/utils/formatters';

import Card from 'primevue/card';
import Button from 'primevue/button';
import AddToWishlistModal from './AddToWishlistModal.vue';

const {
  jobs,
  triggeringJob,
  cancellingJob,
  fetchStatus,
  triggerListenBrainz,
  triggerCatalogDiscovery,
  triggerDownloader,
  cancelJob,
} = useJobs();

const showAddModal = ref(false);

const isJobRunning = computed(() => (name: string) => {
  const job = jobs.value.find((j) => j.name === name);

  return job?.running ?? false;
});

function getJobInfo(name: string) {
  return jobs.value.find((j) => j.name === name);
}

onMounted(() => {
  fetchStatus();
});

async function handleTriggerListenBrainz() {
  try {
    await triggerListenBrainz();
  } catch {
    // Error is already handled in the store
  }
}

async function handleTriggerCatalogDiscovery() {
  try {
    await triggerCatalogDiscovery();
  } catch {
    // Error is already handled in the store
  }
}

async function handleTriggerDownloader() {
  try {
    await triggerDownloader();
  } catch {
    // Error is already handled in the store
  }
}

async function handleCancelJob(jobName: string) {
  try {
    await cancelJob(jobName);
  } catch {
    // Error is already handled in the store
  }
}
</script>

<template>
  <Card>
    <template #title>
      <span class="text-lg font-semibold">Discovery Actions</span>
    </template>
    <template #content>
      <div class="flex flex-wrap gap-4">
        <!-- ListenBrainz Fetch -->
        <div class="flex flex-column gap-1">
          <Button
            v-if="!isJobRunning(JOB_NAMES.LB_FETCH)"
            label="ListenBrainz Fetch"
            icon="pi pi-cloud-download"
            :loading="triggeringJob === JOB_NAMES.LB_FETCH"
            :disabled="triggeringJob !== null"
            @click="handleTriggerListenBrainz"
            class="w-full"
            outlined
          />
          <Button
            v-else
            label="Cancel ListenBrainz"
            icon="pi pi-times"
            :loading="cancellingJob === JOB_NAMES.LB_FETCH"
            :disabled="cancellingJob !== null"
            @click="handleCancelJob(JOB_NAMES.LB_FETCH)"
            class="w-full"
            severity="danger"
            outlined
          >
            <template #icon>
              <span class="flex align-items-center gap-2">
                <i class="pi pi-circle-fill text-green-500 animate-pulse" style="font-size: 0.5rem"></i>
                <i class="pi pi-times"></i>
              </span>
            </template>
          </Button>
          <span v-if="getJobInfo(JOB_NAMES.LB_FETCH)" class="actions-panel__schedule">
            <span v-if="getJobInfo(JOB_NAMES.LB_FETCH)?.lastRun">Last: {{ formatRelativeTime(getJobInfo(JOB_NAMES.LB_FETCH)!.lastRun!) }}</span>
            <span v-if="getJobInfo(JOB_NAMES.LB_FETCH)?.nextRun">Next: {{ formatFutureRelativeTime(getJobInfo(JOB_NAMES.LB_FETCH)!.nextRun!) }}</span>
          </span>
        </div>

        <!-- Catalog Discovery -->
        <div class="flex flex-column gap-1">
          <Button
            v-if="!isJobRunning(JOB_NAMES.CATALOGD)"
            label="Catalog Discovery"
            icon="pi pi-search"
            :loading="triggeringJob === JOB_NAMES.CATALOGD"
            :disabled="triggeringJob !== null"
            @click="handleTriggerCatalogDiscovery"
            class="w-full"
            outlined
          />
          <Button
            v-else
            label="Cancel Catalog"
            icon="pi pi-times"
            :loading="cancellingJob === JOB_NAMES.CATALOGD"
            :disabled="cancellingJob !== null"
            @click="handleCancelJob(JOB_NAMES.CATALOGD)"
            class="w-full"
            severity="danger"
            outlined
          >
            <template #icon>
              <span class="flex align-items-center gap-2">
                <i class="pi pi-circle-fill text-green-500 animate-pulse" style="font-size: 0.5rem"></i>
                <i class="pi pi-times"></i>
              </span>
            </template>
          </Button>
          <span v-if="getJobInfo(JOB_NAMES.CATALOGD)" class="actions-panel__schedule">
            <span v-if="getJobInfo(JOB_NAMES.CATALOGD)?.lastRun">Last: {{ formatRelativeTime(getJobInfo(JOB_NAMES.CATALOGD)!.lastRun!) }}</span>
            <span v-if="getJobInfo(JOB_NAMES.CATALOGD)?.nextRun">Next: {{ formatFutureRelativeTime(getJobInfo(JOB_NAMES.CATALOGD)!.nextRun!) }}</span>
          </span>
        </div>

        <!-- Process Downloads -->
        <div class="flex flex-column gap-1">
          <Button
            v-if="!isJobRunning(JOB_NAMES.SLSKD)"
            label="Process Downloads"
            icon="pi pi-download"
            :loading="triggeringJob === JOB_NAMES.SLSKD"
            :disabled="triggeringJob !== null"
            @click="handleTriggerDownloader"
            class="w-full"
            outlined
          />
          <Button
            v-else
            label="Cancel Downloads"
            icon="pi pi-times"
            :loading="cancellingJob === JOB_NAMES.SLSKD"
            :disabled="cancellingJob !== null"
            @click="handleCancelJob(JOB_NAMES.SLSKD)"
            class="w-full"
            severity="danger"
            outlined
          >
            <template #icon>
              <span class="flex align-items-center gap-2">
                <i class="pi pi-circle-fill text-green-500 animate-pulse" style="font-size: 0.5rem"></i>
                <i class="pi pi-times"></i>
              </span>
            </template>
          </Button>
          <span v-if="getJobInfo(JOB_NAMES.SLSKD)" class="actions-panel__schedule">
            <span v-if="getJobInfo(JOB_NAMES.SLSKD)?.lastRun">Last: {{ formatRelativeTime(getJobInfo(JOB_NAMES.SLSKD)!.lastRun!) }}</span>
            <span v-if="getJobInfo(JOB_NAMES.SLSKD)?.nextRun">Next: {{ formatFutureRelativeTime(getJobInfo(JOB_NAMES.SLSKD)!.nextRun!) }}</span>
          </span>
        </div>

        <!-- Manual Add -->
        <div class="flex flex-column gap-1">
          <Button
            label="Manual Add"
            icon="pi pi-plus"
            @click="showAddModal = true"
            class="w-full"
            outlined
          />
        </div>
      </div>
    </template>
  </Card>

  <AddToWishlistModal v-model:visible="showAddModal" />
</template>

<style scoped>
.actions-panel__schedule {
  display: flex;
  gap: 0.75rem;
  font-size: 0.75rem;
  color: var(--surface-400);
  padding: 0 0.25rem;
}

/* Override button styles for the action button */
:deep(.p-button.p-component.p-button-outlined) {
  background: rgba(43, 43, 238, 0.2);
  border-color: rgba(43, 43, 238, 0.3);
  color: var(--primary-500);
}

:deep(.p-button.p-component.p-button-outlined:hover) {
  background: var(--primary-500);
  border-color: var(--primary-500);
  color: var(--r-text-primary);
}
</style>
