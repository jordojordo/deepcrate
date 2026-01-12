import type { JobStatus } from '@/types/jobs';

import { defineStore } from 'pinia';
import { ref } from 'vue';

import * as jobsApi from '@/services/jobs';
import { useToast } from '@/composables/useToast';

export const useJobsStore = defineStore('jobs', () => {
  const jobs = ref<JobStatus[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);
  const triggeringJob = ref<string | null>(null);
  const cancellingJob = ref<string | null>(null);

  // Call useToast at store setup level, not inside async functions
  const { showSuccess, showError } = useToast();

  async function fetchStatus() {
    loading.value = true;
    error.value = null;

    try {
      const response = await jobsApi.getJobStatus();

      jobs.value = response.jobs;
    } catch(e) {
      error.value = e instanceof Error ? e.message : 'Failed to fetch job status';
    } finally {
      loading.value = false;
    }
  }

  async function trigger(name: string) {
    triggeringJob.value = name;
    error.value = null;

    try {
      const response = await jobsApi.triggerJob(name);

      if (response.success) {
        showSuccess('Job triggered', response.message);
      } else {
        showError('Job failed', response.message);
      }

      // Refresh status after triggering
      await fetchStatus();
    } catch(e) {
      const message = e instanceof Error ? e.message : 'Failed to trigger job';

      error.value = message;
      showError('Failed to trigger job', message);
      throw e;
    } finally {
      triggeringJob.value = null;
    }
  }

  async function cancel(name: string) {
    cancellingJob.value = name;
    error.value = null;

    try {
      const response = await jobsApi.cancelJob(name);

      if (response.success) {
        showSuccess('Job cancelled', response.message);
      } else {
        showError('Cancel failed', response.message);
      }

      // Refresh status after cancelling
      await fetchStatus();
    } catch(e) {
      const message = e instanceof Error ? e.message : 'Failed to cancel job';

      error.value = message;
      showError('Failed to cancel job', message);
      throw e;
    } finally {
      cancellingJob.value = null;
    }
  }

  return {
    jobs,
    loading,
    error,
    triggeringJob,
    cancellingJob,
    fetchStatus,
    trigger,
    cancel,
  };
});
