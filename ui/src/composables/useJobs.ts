import { computed } from 'vue';
import { JOB_NAMES } from '@/constants/jobs';
import { useJobsStore } from '@/stores/jobs';

export function useJobs() {
  const store = useJobsStore();

  const jobs = computed(() => store.jobs);
  const loading = computed(() => store.loading);
  const error = computed(() => store.error);
  const triggeringJob = computed(() => store.triggeringJob);
  const cancellingJob = computed(() => store.cancellingJob);

  async function fetchStatus() {
    return store.fetchStatus();
  }

  async function triggerListenBrainz() {
    return store.trigger(JOB_NAMES.LB_FETCH);
  }

  async function triggerCatalogDiscovery() {
    return store.trigger(JOB_NAMES.CATALOGD);
  }

  async function triggerDownloader() {
    return store.trigger(JOB_NAMES.SLSKD);
  }

  async function cancelJob(name: string) {
    return store.cancel(name);
  }

  return {
    jobs,
    loading,
    error,
    triggeringJob,
    cancellingJob,
    fetchStatus,
    triggerListenBrainz,
    triggerCatalogDiscovery,
    triggerDownloader,
    cancelJob,
  };
}
