import type { Socket } from 'socket.io-client';
import type {
  JobStartedEvent,
  JobProgressEvent,
  JobCompletedEvent,
  JobFailedEvent,
  JobCancelledEvent,
} from '@/types';

import { onMounted, onUnmounted } from 'vue';
import { useJobsStore } from '@/stores/jobs';
import { useLibraryStore } from '@/stores/library';
import { useSocketConnection } from './useSocketConnection';

export function useJobsSocket() {
  const { connected, connect, disconnect } = useSocketConnection('/jobs');
  const store = useJobsStore();
  const libraryStore = useLibraryStore();

  let socket: Socket | null = null;

  function handleJobStarted(event: JobStartedEvent) {
    const job = store.jobs.find((j) => j.name === event.name);

    if (job) {
      job.running = true;
      job.lastRun = event.startedAt;
    }
  }

  function handleJobProgress(event: JobProgressEvent) {
    if (event.name === 'library-organize') {
      libraryStore.setOrganizeProgress({
        message: event.message,
        current: event.current,
        total:   event.total,
      });
    }
  }

  function handleJobCompleted(event: JobCompletedEvent) {
    const job = store.jobs.find((j) => j.name === event.name);

    if (job) {
      job.running = false;
    }

    if (event.name === 'library-organize') {
      libraryStore.clearOrganizeProgress();
    }
  }

  function handleJobFailed(event: JobFailedEvent) {
    const job = store.jobs.find((j) => j.name === event.name);

    if (job) {
      job.running = false;
    }

    if (event.name === 'library-organize') {
      libraryStore.clearOrganizeProgress();
    }
  }

  function handleJobCancelled(event: JobCancelledEvent) {
    const job = store.jobs.find((j) => j.name === event.name);

    if (job) {
      job.running = false;
    }

    if (event.name === 'library-organize') {
      libraryStore.clearOrganizeProgress();
    }
  }

  onMounted(() => {
    socket = connect();

    socket.on('job:started', handleJobStarted);
    socket.on('job:progress', handleJobProgress);
    socket.on('job:completed', handleJobCompleted);
    socket.on('job:failed', handleJobFailed);
    socket.on('job:cancelled', handleJobCancelled);
  });

  onUnmounted(() => {
    if (socket) {
      socket.off('job:started', handleJobStarted);
      socket.off('job:progress', handleJobProgress);
      socket.off('job:completed', handleJobCompleted);
      socket.off('job:failed', handleJobFailed);
      socket.off('job:cancelled', handleJobCancelled);
    }

    disconnect();
  });

  return { connected };
}
