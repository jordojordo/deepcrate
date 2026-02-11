import type { Socket } from 'socket.io-client';
import type {
  DownloadTaskCreatedEvent,
  DownloadTaskUpdatedEvent,
  DownloadProgressEvent,
  DownloadStatsUpdatedEvent,
  DownloadPendingSelectionEvent,
  DownloadSelectionExpiredEvent,
} from '@/types';

import { onMounted, onUnmounted } from 'vue';
import { useSocketConnection } from '@/composables/useSocketConnection';
import { useDownloadsStore } from '@/stores/downloads';

export function useDownloadsSocket() {
  const { connected, connect, disconnect } = useSocketConnection('/downloads');
  const store = useDownloadsStore();

  let socket: Socket | null = null;

  function handleTaskCreated(event: DownloadTaskCreatedEvent) {
    store.activeDownloads.unshift(event.task);
    store.activeTotal++;
  }

  function handleTaskUpdated(event: DownloadTaskUpdatedEvent) {
    const index = store.activeDownloads.findIndex((d) => d.id === event.id);

    if (index === -1) {
      return;
    }

    const download = store.activeDownloads[index];

    if (!download) {
      return;
    }

    download.status = event.status as typeof download.status;

    if (event.slskdUsername !== undefined) {
      download.slskdUsername = event.slskdUsername;
    }

    if (event.fileCount !== undefined) {
      download.fileCount = event.fileCount;
    }

    if (event.status === 'completed' || event.status === 'failed') {
      store.activeDownloads.splice(index, 1);
      store.activeTotal = Math.max(0, store.activeTotal - 1);

      // Refresh the appropriate list to show the new item
      if (event.status === 'completed') {
        store.fetchCompleted();
      } else {
        store.fetchFailed();
      }
    }
  }

  function handleProgress(event: DownloadProgressEvent) {
    const download = store.activeDownloads.find((d) => d.id === event.id);

    if (download) {
      download.progress = event.progress;
    }
  }

  function handleStatsUpdated(event: DownloadStatsUpdatedEvent) {
    store.stats = event;
  }

  function handlePendingSelection(event: DownloadPendingSelectionEvent) {
    const download = store.activeDownloads.find((d) => d.id === event.id);

    if (download) {
      download.status = 'pending_selection';
      download.selectionExpiresAt = event.selectionExpiresAt;
    } else {
      // Task not in list yet, refresh active downloads
      store.fetchActive();
    }
  }

  function handleSelectionExpired(event: DownloadSelectionExpiredEvent) {
    const index = store.activeDownloads.findIndex((d) => d.id === event.id);

    if (index !== -1) {
      store.activeDownloads.splice(index, 1);
      store.activeTotal = Math.max(0, store.activeTotal - 1);
      store.fetchFailed();
    }
  }

  onMounted(() => {
    socket = connect();

    socket.on('download:task:created', handleTaskCreated);
    socket.on('download:task:updated', handleTaskUpdated);
    socket.on('download:progress', handleProgress);
    socket.on('download:stats:updated', handleStatsUpdated);
    socket.on('download:pending_selection', handlePendingSelection);
    socket.on('download:selection_expired', handleSelectionExpired);
  });

  onUnmounted(() => {
    if (socket) {
      socket.off('download:task:created', handleTaskCreated);
      socket.off('download:task:updated', handleTaskUpdated);
      socket.off('download:progress', handleProgress);
      socket.off('download:stats:updated', handleStatsUpdated);
      socket.off('download:pending_selection', handlePendingSelection);
      socket.off('download:selection_expired', handleSelectionExpired);
    }

    disconnect();
  });

  return { connected };
}
