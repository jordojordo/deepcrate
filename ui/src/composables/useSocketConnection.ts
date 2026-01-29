import type { Ref } from 'vue';
import type { SocketNamespace } from '@/types/socket';

import { ref } from 'vue';
import { io, Socket } from 'socket.io-client';

interface SocketConnection {
  socket:    Socket | null;
  refCount:  number;
  connected: Ref<boolean>;
  error:     Ref<string | null>;
}

const connections = new Map<SocketNamespace, SocketConnection>();

function getAuthToken(): string | null {
  const basicAuth = localStorage.getItem('auth_credentials');

  if (basicAuth) {
    return `Basic ${ basicAuth }`;
  }

  const apiKey = localStorage.getItem('auth_api_key');

  if (apiKey) {
    return `Bearer ${ apiKey }`;
  }

  return null;
}

function createConnection(namespace: SocketNamespace): SocketConnection {
  const connected = ref(false);
  const error = ref<string | null>(null);

  const token = getAuthToken();

  const socket = io(namespace, {
    auth:                 { token },
    autoConnect:          false,
    reconnection:         true,
    reconnectionAttempts: 5,
    reconnectionDelay:    1000,
    reconnectionDelayMax: 5000,
  });

  socket.on('connect', () => {
    connected.value = true;
    error.value = null;
    console.debug(`[socket] Connected to ${ namespace }`);
  });

  socket.on('disconnect', (reason) => {
    connected.value = false;
    console.debug(`[socket] Disconnected from ${ namespace }: ${ reason }`);
  });

  socket.on('connect_error', (err) => {
    error.value = err.message;
    console.error(`[socket] Connection error on ${ namespace }:`, err.message);
  });

  return {
    socket,
    refCount: 0,
    connected,
    error,
  };
}

/**
 * Composable for managing socket connections with ref counting.
 * Returns a connection that auto-connects on first use and disconnects
 * when all subscribers have unsubscribed.
 */
export function useSocketConnection(namespace: SocketNamespace) {
  let connection = connections.get(namespace);

  if (!connection) {
    connection = createConnection(namespace);
    connections.set(namespace, connection);
  }

  function connect(): Socket {
    if (!connection!.socket) {
      throw new Error(`Socket connection for ${ namespace } not initialized`);
    }

    connection!.refCount++;

    // Connect if this is the first subscriber
    if (connection!.refCount === 1) {
      connection!.socket.connect();
    }

    return connection!.socket;
  }

  function disconnect(): void {
    if (!connection!.socket) {
      return;
    }

    connection!.refCount--;

    // Disconnect if no more subscribers
    if (connection!.refCount <= 0) {
      connection!.refCount = 0;
      connection!.socket.disconnect();
    }
  }

  return {
    connected: connection.connected,
    error:     connection.error,
    connect,
    disconnect,
  };
}
