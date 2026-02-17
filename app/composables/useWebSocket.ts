/**
 * useWebSocket Composable
 *
 * Manages the WebSocket connection to the server.
 * Provides reactive connection status information and message handling.
 */

import type { Ref } from 'vue';
import type {
  ClientMessage,
  ServerMessage,
  ServerMessageType,
} from '~/types/websocket';

/**
 * WebSocket connection status
 */
export type ConnectionStatus =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'error';

/**
 * Event handler type
 */
type MessageHandler<T = unknown> = (payload: T) => void;

/**
 * WebSocket composable options
 */
interface UseWebSocketOptions {
  /** Connect automatically on creation */
  autoConnect?: boolean;
  /** Automatically reconnect on disconnect */
  autoReconnect?: boolean;
  /** Reconnect delay in ms */
  reconnectDelay?: number;
  /** Maximum reconnect attempts */
  maxReconnectAttempts?: number;
}

/**
 * WebSocket composable return type
 */
interface UseWebSocketReturn {
  /** Current connection status */
  status: Ref<ConnectionStatus>;
  /** Send a typed message */
  send: <P>(type: string, payload: P) => void;
  /** Register a handler for a message type */
  on: <T>(type: ServerMessageType, handler: MessageHandler<T>) => void;
  /** Unregister a handler */
  off: (type: ServerMessageType, handler: MessageHandler) => void;
  /** Connect to server */
  connect: () => void;
  /** Disconnect from server */
  disconnect: () => void;
}

/**
 * Client-only singleton state
 */
interface ClientSingletonState {
  ws: WebSocket | null;
  status: Ref<ConnectionStatus>;
  handlers: Map<string, Set<MessageHandler>>;
  reconnectAttempts: number;
  reconnectTimer: ReturnType<typeof setTimeout> | null;
  pingInterval: ReturnType<typeof setInterval> | null;
}

let clientState: ClientSingletonState | null = null;

/**
 * Get or create client-only singleton state
 */
function getClientState(): ClientSingletonState {
  if (!clientState) {
    clientState = {
      ws: null,
      status: ref<ConnectionStatus>('disconnected'),
      handlers: new Map(),
      reconnectAttempts: 0,
      reconnectTimer: null,
      pingInterval: null,
    };
  }
  return clientState;
}

/**
 * useWebSocket Composable
 *
 * @param options - Configuration options
 * @returns WebSocket management functions
 */
export function useWebSocket(
  options: UseWebSocketOptions = {}
): UseWebSocketReturn {
  const {
    autoConnect = true,
    autoReconnect = true,
    reconnectDelay = 2000,
    maxReconnectAttempts = 10,
  } = options;

  // Server-side: return no-op
  if (!import.meta.client) {
    const status = ref<ConnectionStatus>('disconnected');
    return {
      status,
      send: () => {},
      on: () => {},
      off: () => {},
      connect: () => {},
      disconnect: () => {},
    };
  }

  const state = getClientState();

  /**
   * Builds the WebSocket URL
   */
  function getWsUrl(): string {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${window.location.host}/_ws`;
  }

  /**
   * Connects to the WebSocket server
   */
  function connect(): void {
    if (
      state.ws?.readyState === WebSocket.OPEN ||
      state.ws?.readyState === WebSocket.CONNECTING
    ) {
      return;
    }

    state.status.value = 'connecting';

    try {
      state.ws = new WebSocket(getWsUrl());

      state.ws.onopen = () => {
        state.status.value = 'connected';
        state.reconnectAttempts = 0;
        startPingInterval();
      };

      state.ws.onmessage = (event: MessageEvent) => {
        try {
          const message = JSON.parse(event.data as string) as ServerMessage;
          const handlers = state.handlers.get(message.type);
          if (handlers) {
            handlers.forEach((handler) => handler(message.payload));
          }
        } catch (error) {
          console.error('[WebSocket] Error parsing message:', error);
        }
      };

      state.ws.onclose = () => {
        state.status.value = 'disconnected';
        stopPingInterval();
        if (autoReconnect) {
          scheduleReconnect();
        }
      };

      state.ws.onerror = () => {
        state.status.value = 'error';
        stopPingInterval();
      };
    } catch {
      state.status.value = 'error';
    }
  }

  /**
   * Disconnects from the server
   */
  function disconnect(): void {
    if (state.reconnectTimer) {
      clearTimeout(state.reconnectTimer);
      state.reconnectTimer = null;
    }
    stopPingInterval();
    state.reconnectAttempts = maxReconnectAttempts; // Prevent reconnect
    state.ws?.close();
    state.ws = null;
    state.status.value = 'disconnected';
  }

  /**
   * Schedules a reconnect attempt
   */
  function scheduleReconnect(): void {
    if (state.reconnectAttempts >= maxReconnectAttempts) {
      state.status.value = 'error';
      return;
    }

    const delay = reconnectDelay * Math.pow(1.5, state.reconnectAttempts);
    state.reconnectAttempts++;

    state.reconnectTimer = setTimeout(() => {
      connect();
    }, delay);
  }

  /**
   * Starts a ping interval to keep connection alive
   */
  function startPingInterval(): void {
    stopPingInterval();
    state.pingInterval = setInterval(() => {
      send('ping', {});
    }, 30000);
  }

  /**
   * Stops the ping interval
   */
  function stopPingInterval(): void {
    if (state.pingInterval) {
      clearInterval(state.pingInterval);
      state.pingInterval = null;
    }
  }

  /**
   * Sends a typed message
   */
  function send<P>(type: string, payload: P): void {
    if (!state.ws || state.ws.readyState !== WebSocket.OPEN) {
      console.warn('[WebSocket] Not connected, cannot send:', type);
      return;
    }

    const message: ClientMessage = {
      type: type as ClientMessage['type'],
      payload,
      timestamp: Date.now(),
    };
    state.ws.send(JSON.stringify(message));
  }

  /**
   * Registers a handler for a message type
   */
  function on<T>(type: ServerMessageType, handler: MessageHandler<T>): void {
    if (!state.handlers.has(type)) {
      state.handlers.set(type, new Set());
    }
    state.handlers.get(type)!.add(handler as MessageHandler);
  }

  /**
   * Unregisters a handler
   */
  function off(type: ServerMessageType, handler: MessageHandler): void {
    state.handlers.get(type)?.delete(handler);
  }

  // Auto-connect on mount
  if (autoConnect) {
    onMounted(() => {
      connect();
    });
  }

  return {
    status: state.status,
    send,
    on,
    off,
    connect,
    disconnect,
  };
}
