import { useEffect, useMemo, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { getServerUrl } from './serverUrl';

const SERVER_URL = getServerUrl();

export function useJeopardySocket({ sessionId, role, playerId }) {
  const socket = useMemo(() => {
    return io(SERVER_URL, {
      transports: ['websocket'],
      autoConnect: false,
    });
  }, []);

  const [state, setState] = useState(null);
  const [error, setError] = useState(null);
  const [connected, setConnected] = useState(false);
  const pendingRef = useRef([]);

  useEffect(() => {
    if (!sessionId) return;

    setError(null);
    setConnected(false);
    socket.connect();

    const onUpdate = (nextState) => setState(nextState);
    const onError = (payload) => setError(payload?.error || 'Socket error');
    const onConnect = () => {
      setConnected(true);
      socket.emit('client:join', { sessionId, role, playerId });
      if (pendingRef.current.length) {
        for (const item of pendingRef.current) socket.emit(item.event, item.payload);
        pendingRef.current = [];
      }
    };
    const onConnectError = () => setError('Unable to connect to server');
    const onDisconnect = () => {
      // Avoid showing a disconnect error during unmount/disconnect cleanup.
      setConnected(false);
    };

    socket.on('state:update', onUpdate);
    socket.on('error', onError);
    socket.on('connect', onConnect);
    socket.on('connect_error', onConnectError);
    socket.on('disconnect', onDisconnect);

    return () => {
      socket.off('state:update', onUpdate);
      socket.off('error', onError);
      socket.off('connect', onConnect);
      socket.off('connect_error', onConnectError);
      socket.off('disconnect', onDisconnect);
      socket.disconnect();
      setConnected(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, role, playerId]);

  function emit(event, payload) {
    if (!socket) return;
    if (!socket.connected) {
      pendingRef.current.push({ event, payload });
      socket.connect();
      return;
    }
    socket.emit(event, payload);
  }

  return { state, error, emit, SERVER_URL, connected };
}

