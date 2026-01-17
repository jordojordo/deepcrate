import type { Socket } from 'socket.io-client';
import type {
  JobStartedEvent,
  JobCompletedEvent,
  JobFailedEvent,
  JobCancelledEvent,
} from '@/types/socket';

import { onMounted, onUnmounted } from 'vue';
import { useJobsStore } from '@/stores/jobs';
import { useSocketConnection } from './useSocketConnection';

export function useJobsSocket() {
  const { connected, connect, disconnect } = useSocketConnection('/jobs');
  const store = useJobsStore();

  let socket: Socket | null = null;

  function handleJobStarted(event: JobStartedEvent) {
    const job = store.jobs.find((j) => j.name === event.name);

    if (job) {
      job.running = true;
      job.lastRun = event.startedAt;
    }
  }

  function handleJobCompleted(event: JobCompletedEvent) {
    const job = store.jobs.find((j) => j.name === event.name);

    if (job) {
      job.running = false;
    }
  }

  function handleJobFailed(event: JobFailedEvent) {
    const job = store.jobs.find((j) => j.name === event.name);

    if (job) {
      job.running = false;
    }
  }

  function handleJobCancelled(event: JobCancelledEvent) {
    const job = store.jobs.find((j) => j.name === event.name);

    if (job) {
      job.running = false;
    }
  }

  onMounted(() => {
    socket = connect();

    socket.on('job:started', handleJobStarted);
    socket.on('job:completed', handleJobCompleted);
    socket.on('job:failed', handleJobFailed);
    socket.on('job:cancelled', handleJobCancelled);
  });

  onUnmounted(() => {
    if (socket) {
      socket.off('job:started', handleJobStarted);
      socket.off('job:completed', handleJobCompleted);
      socket.off('job:failed', handleJobFailed);
      socket.off('job:cancelled', handleJobCancelled);
    }

    disconnect();
  });

  return { connected };
}
