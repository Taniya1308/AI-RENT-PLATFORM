import { useEffect, useRef, useState, useCallback } from 'react';

const WS_URL = process.env.REACT_APP_WS_URL || `ws://${window.location.hostname}:5000/ws`;

export function useWebSocket(onMessage) {
  const ws = useRef(null);
  const [connected, setConnected] = useState(false);
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  const reconnectTimeout = useRef(null);

  const connect = useCallback(() => {
    const token = localStorage.getItem('token');
    if (!token) return;

    const socket = new WebSocket(`${WS_URL}?token=${token}`);
    ws.current = socket;

    socket.onopen = () => {
      setConnected(true);
      console.log('WebSocket connected');
    };

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (onMessageRef.current) onMessageRef.current(data);
      } catch (e) {
        console.error('WS parse error', e);
      }
    };

    socket.onclose = () => {
      setConnected(false);
      // Reconnect after 3 seconds
      reconnectTimeout.current = setTimeout(connect, 3000);
    };

    socket.onerror = () => {
      socket.close();
    };
  }, []);

  useEffect(() => {
    connect();
    return () => {
      clearTimeout(reconnectTimeout.current);
      if (ws.current) ws.current.close();
    };
  }, [connect]);

  const send = useCallback((data) => {
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify(data));
    }
  }, []);

  return { connected, send };
}
