import type { Socket } from 'socket.io-client';
import type { ActivityNewEvent } from '@/types';

import { onMounted, onUnmounted } from 'vue';

import { useActivityStore } from '@/stores/activity';
import { useSocketConnection } from '@/composables/useSocketConnection';

export function useActivitySocket() {
  const { connected, connect, disconnect } = useSocketConnection('/activity');
  const store = useActivityStore();

  let socket: Socket | null = null;

  function handleActivityNew(event: ActivityNewEvent) {
    store.addItem(event.item);
  }

  onMounted(() => {
    socket = connect();

    socket.on('activity:new', handleActivityNew);
  });

  onUnmounted(() => {
    if (socket) {
      socket.off('activity:new', handleActivityNew);
    }

    disconnect();
  });

  return { connected };
}
