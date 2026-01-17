import { onMounted, onUnmounted } from 'vue';
import type { Socket } from 'socket.io-client';
import { useSocketConnection } from './useSocketConnection';
import { useQueueStore } from '@/stores/queue';
import type {
  QueueItemAddedEvent,
  QueueItemUpdatedEvent,
  QueueStatsUpdatedEvent,
} from '@/types/socket';

/**
 * Composable for real-time queue updates via WebSocket.
 * Automatically connects on mount and disconnects on unmount.
 * Updates are applied directly to the queue store.
 */
export function useQueueSocket() {
  const { connected, connect, disconnect } = useSocketConnection('/queue');
  const store = useQueueStore();

  let socket: Socket | null = null;

  function handleItemAdded(event: QueueItemAddedEvent) {
    // Add new item to the beginning of the list
    store.items.unshift(event.item);
    store.total++;
  }

  function handleItemUpdated(event: QueueItemUpdatedEvent) {
    // Remove item from list (it was approved/rejected)
    const index = store.items.findIndex((item) => item.mbid === event.mbid);

    if (index !== -1) {
      store.items.splice(index, 1);
      store.total = Math.max(0, store.total - 1);
    }
  }

  function handleStatsUpdated(event: QueueStatsUpdatedEvent) {
    // Stats are primarily used by DashboardPage via useStats
    // The total is already updated by add/remove handlers
    // This event is useful for keeping multiple clients in sync
    if (store.total !== event.pending) {
      store.total = event.pending;
    }
  }

  onMounted(() => {
    socket = connect();

    socket.on('queue:item:added', handleItemAdded);
    socket.on('queue:item:updated', handleItemUpdated);
    socket.on('queue:stats:updated', handleStatsUpdated);
  });

  onUnmounted(() => {
    if (socket) {
      socket.off('queue:item:added', handleItemAdded);
      socket.off('queue:item:updated', handleItemUpdated);
      socket.off('queue:stats:updated', handleStatsUpdated);
    }

    disconnect();
  });

  return { connected };
}
