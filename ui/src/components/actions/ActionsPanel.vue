<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import Card from 'primevue/card';
import Button from 'primevue/button';
import { JOB_NAMES } from '@/constants/jobs';
import { useJobs } from '@/composables/useJobs';
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
      <div class="inline-flex gap-4">
        <!-- ListenBrainz Fetch -->
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

        <!-- Catalog Discovery -->
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

        <!-- Process Downloads -->
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

        <!-- Manual Add -->
        <Button
          label="Manual Add"
          icon="pi pi-plus"
          @click="showAddModal = true"
          class="w-full"
          outlined
        />
      </div>
    </template>
  </Card>

  <AddToWishlistModal v-model:visible="showAddModal" />
</template>
