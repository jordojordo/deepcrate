import type { Socket } from 'socket.io-client';
import type { DownloadTaskUpdatedEvent } from '@/types/socket';
import type { WishlistDownloadStatus } from '@/types/wishlist';

import { onMounted, onUnmounted } from 'vue';
import { useSocketConnection } from './useSocketConnection';
import { useWishlistStore } from '@/stores/wishlist';

export function useWishlistSocket() {
  const { connected, connect, disconnect } = useSocketConnection('/downloads');
  const store = useWishlistStore();

  let socket: Socket | null = null;

  function handleTaskUpdated(event: DownloadTaskUpdatedEvent) {
    const status = event.status as WishlistDownloadStatus;

    store.updateItemDownloadStatus(event.id, status, event.errorMessage);
  }

  onMounted(() => {
    socket = connect();
    socket.on('download:task:updated', handleTaskUpdated);
  });

  onUnmounted(() => {
    if (socket) {
      socket.off('download:task:updated', handleTaskUpdated);
    }

    disconnect();
  });

  return { connected };
}
