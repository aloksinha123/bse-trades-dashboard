import { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';

/**
 * Resolves the Socket.IO server URL from environment variables,
 * falling back to local HTTP backend.
 */
function getSocketUrl() {
  const envUrl =
    import.meta.env.VITE_SOCKET_URL ||
    import.meta.env.VITE_API_BASE_URL ||
    import.meta.env.VITE_API_URL ||
    'http://localhost:5000';
  return envUrl;
}

/**
 * Custom hook managing real-time Socket.IO connection and trade event subscriptions.
 * Exclusively event-driven; performs zero polling.
 *
 * @param {Object} callbacks Event handler callbacks
 * @param {Function} callbacks.onPullStarted
 * @param {Function} callbacks.onTradesNew
 * @param {Function} callbacks.onPullCompleted
 * @param {Function} callbacks.onPullFailed
 */
export function useTradeSocket({
  onPullStarted,
  onTradesNew,
  onPullCompleted,
  onPullFailed
} = {}) {
  const [connectionStatus, setConnectionStatus] = useState('connecting'); // 'connected' | 'connecting' | 'disconnected'
  const [socketId, setSocketId] = useState(null);

  // Store latest callbacks in refs to avoid re-subscribing on each render
  const callbacksRef = useRef({
    onPullStarted,
    onTradesNew,
    onPullCompleted,
    onPullFailed
  });

  useEffect(() => {
    callbacksRef.current = {
      onPullStarted,
      onTradesNew,
      onPullCompleted,
      onPullFailed
    };
  }, [onPullStarted, onTradesNew, onPullCompleted, onPullFailed]);

  useEffect(() => {
    const socketUrl = getSocketUrl();
    const isSecure = socketUrl.startsWith('https://');

    // Initialize Socket.IO with explicit protocol configuration
    const socket = io(socketUrl, {
      transports: ['websocket', 'polling'],
      secure: isSecure,
      rejectUnauthorized: isSecure,
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000
    });

    socket.on('connect', () => {
      setConnectionStatus('connected');
      setSocketId(socket.id);
    });

    socket.on('disconnect', (reason) => {
      setConnectionStatus('disconnected');
    });

    socket.on('connect_error', () => {
      setConnectionStatus('disconnected');
    });

    // Real-time Event Listeners
    socket.on('pull:started', (data) => {
      if (callbacksRef.current.onPullStarted) {
        callbacksRef.current.onPullStarted(data);
      }
    });

    socket.on('trades:new', (data) => {
      if (callbacksRef.current.onTradesNew) {
        callbacksRef.current.onTradesNew(data);
      }
    });

    socket.on('pull:completed', (data) => {
      if (callbacksRef.current.onPullCompleted) {
        callbacksRef.current.onPullCompleted(data);
      }
    });

    socket.on('pull:failed', (data) => {
      if (callbacksRef.current.onPullFailed) {
        callbacksRef.current.onPullFailed(data);
      }
    });

    return () => {
      socket.removeAllListeners();
      socket.disconnect();
    };
  }, []);

  return {
    connectionStatus,
    socketId
  };
}
