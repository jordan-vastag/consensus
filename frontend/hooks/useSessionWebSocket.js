"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const WS_BASE_URL = "ws://localhost:8080/api";

export function useSessionWebSocket(sessionCode, memberName, handlers = {}) {
  const [isConnected, setIsConnected] = useState(false);
  const [webSocketError, setWebsocketError] = useState(null);
  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const handlersRef = useRef(handlers);
  const shouldReconnectRef = useRef(true);
  const connectRef = useRef(null);

  // Keep handlers ref updated
  useEffect(() => {
    handlersRef.current = handlers;
  }, [handlers]);

  const connect = useCallback(() => {
    if (!sessionCode || !memberName) return;

    const url = `${WS_BASE_URL}/session/${sessionCode}/ws?name=${encodeURIComponent(memberName)}`;

    try {
      const ws = new WebSocket(url);

      ws.onopen = () => {
        setIsConnected(true);
        setWebsocketError(null);
      };

      ws.onclose = (event) => {
        setIsConnected(false);
        wsRef.current = null;

        // Reconnect unless it was a clean close or we've disconnected intentionally
        if (!event.wasClean && shouldReconnectRef.current) {
          reconnectTimeoutRef.current = setTimeout(() => {
            if (shouldReconnectRef.current && connectRef.current) {
              connectRef.current();
            }
          }, 2000);
        }
      };

      ws.onerror = () => {
        setWebsocketError("WebSocket connection error");
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          const { onMemberJoined, onMemberLeft, onMemberReady, onPhaseChanged, onConnectedUsers } = handlersRef.current;

          switch (message.type) {
            case "member_joined":
              onMemberJoined?.(message.memberName, message.host);
              break;
            case "member_left":
              onMemberLeft?.(message.memberName);
              break;
            case "member_ready":
              onMemberReady?.(message.memberName, message.ready);
              break;
            case "phase_changed":
              onPhaseChanged?.(message.phase, message.ready);
              break;
            case "connected_users":
              onConnectedUsers?.(message.members);
              break;
            default:
              console.log("Unknown message type:", message.type);
          }
        } catch (e) {
          console.error("Failed to parse WebSocket message:", e);
        }
      };

      wsRef.current = ws;
    } catch (e) {
      setWebsocketError("Failed to create WebSocket connection");
    }
  }, [sessionCode, memberName]);

  // Keep connect ref updated for reconnection
  useEffect(() => {
    connectRef.current = connect;
  }, [connect]);

  const disconnect = useCallback(() => {
    shouldReconnectRef.current = false;
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setIsConnected(false);
  }, []);

  const setReady = useCallback((ready) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "set_ready", ready }));
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return {
    isConnected,
    webSocketError,
    connect,
    disconnect,
    setReady,
  };
}
