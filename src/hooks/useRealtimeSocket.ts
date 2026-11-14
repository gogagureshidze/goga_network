"use client";

import { useAuth } from "@clerk/nextjs";
import { useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import { useLocalAccountReady } from "@/components/auth/LocalAccountBootstrap";

export type RealtimeAck<T> =
  | ({ ok: true } & T)
  | { ok: false; error: { code: string; message: string; retryAfterMs?: number } };

type Connection = {
  socket: Socket;
  users: number;
  token: () => Promise<string | null>;
  refresh: ReturnType<typeof setInterval>;
  onlineCount: number;
  reconnect: () => void;
  dispose: () => void;
};

// One authenticated connection per account per browser tab. Components own only
// their event listeners, and never disconnect another component's connection.
const connections = new Map<string, Connection>();

function acquire(userId: string, getToken: () => Promise<string | null>) {
  let connection = connections.get(userId);
  if (!connection) {
    let recoveryAttempts = 0;
    let recoveryPending = false;
    let expired = false;
    let refreshing = false;
    let lastRefreshAt = 0;
    const isCurrent = () => Boolean(connection && connections.get(userId) === connection && connection.users > 0);
    const socket = io(
      process.env.NEXT_PUBLIC_SOCKET_URL ||
        (process.env.NODE_ENV === "production" ? "https://socket.goga.network" : "http://localhost:3001"),
      {
        autoConnect: false,
        auth: (callback) => {
          void connection?.token().then(
            (token) => { if (isCurrent()) callback({ token }); },
            () => { if (isCurrent()) callback({ token: null }); },
          );
        },
        transports: ["polling", "websocket"],
        reconnectionAttempts: 8,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 15000,
        randomizationFactor: 0.5,
        timeout: 15000,
      },
    );
    const recover = (manual = false) => {
      if (!isCurrent() || socket.connected || recoveryPending) return;
      // Transport failures already use Socket.IO's bounded backoff. A server
      // disconnect stops that machinery, so expired sessions need an explicit
      // connect, whose auth callback obtains a fresh Clerk token.
      if (!manual && (socket.active || recoveryAttempts >= 3)) return;
      if (manual) recoveryAttempts = 0;
      recoveryAttempts += 1;
      recoveryPending = true;
      socket.connect();
    };
    const refreshToken = () => {
      if (!isCurrent() || !socket.connected || refreshing || Date.now() - lastRefreshAt < 10000) return;
      refreshing = true;
      lastRefreshAt = Date.now();
      void connection!.token().then((token) => {
        if (token && isCurrent() && socket.connected) socket.emit("auth:refresh", { token });
      }).catch(() => { /* Expiry recovery or the next foreground refresh can retry. */ })
        .finally(() => { refreshing = false; });
    };
    const foreground = () => {
      if (document.visibilityState !== "visible") return;
      if (socket.connected) refreshToken();
      else recover();
    };
    socket.on("sessionExpired", () => { expired = true; });
    socket.on("disconnect", (reason) => {
      recoveryPending = false;
      if (reason === "io server disconnect" && expired) { expired = false; recover(); }
    });
    socket.on("connect", () => { recoveryAttempts = 0; recoveryPending = false; expired = false; });
    socket.on("connect_error", () => { recoveryPending = false; });
    document.addEventListener("visibilitychange", foreground);
    window.addEventListener("online", foreground);
    connection = {
      socket,
      users: 0,
      token: getToken,
      onlineCount: 0,
      refresh: setInterval(refreshToken, 30000),
      reconnect: () => recover(true),
      dispose: () => {
        document.removeEventListener("visibilitychange", foreground);
        window.removeEventListener("online", foreground);
      },
    };
    socket.on("onlineCount", (count: number) => {
      if (connection && Number.isInteger(count) && count >= 0) connection.onlineCount = count;
    });
    connections.set(userId, connection);
    connection.users = 1;
    socket.connect();
    return connection;
  }
  connection.users += 1;
  connection.token = getToken;
  return connection;
}

function release(userId: string) {
  const connection = connections.get(userId);
  if (!connection) return;
  connection.users -= 1;
  // Let React StrictMode's setup/cleanup cycle reuse the same connection.
  queueMicrotask(() => {
    if (connection.users > 0 || connections.get(userId) !== connection) return;
    clearInterval(connection.refresh);
    connection.dispose();
    connection.socket.disconnect();
    connection.socket.removeAllListeners();
    connections.delete(userId);
  });
}

export function useRealtimeSocket() {
  const { userId, isLoaded, getToken } = useAuth();
  const accountReady = useLocalAccountReady(userId);
  const sessionRef = useRef({ userId, isLoaded, getToken });
  sessionRef.current = { userId, isLoaded, getToken };
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [onlineCount, setOnlineCount] = useState(0);

  useEffect(() => {
    if (!isLoaded || !userId || !accountReady) {
      setSocket(null);
      setConnected(false);
      setOnlineCount(0);
      return;
    }
    const connection = acquire(userId, async () => {
      const session = sessionRef.current;
      if (!session.isLoaded || session.userId !== userId) return null;
      const token = await session.getToken({ skipCache: true });
      return sessionRef.current.isLoaded && sessionRef.current.userId === userId ? token : null;
    });
    const current = connection.socket;
    setSocket(current);
    setConnected(current.connected);
    setOnlineCount(connection.onlineCount);
    const connected = () => { setConnected(true); setConnectionError(null); };
    const disconnected = () => { setConnected(false); };
    const failed = () => { setConnected(false); setConnectionError("Could not connect. Check your connection and sign-in status."); };
    const retrying = () => { setConnectionError("Reconnecting…"); };
    const exhausted = () => { setConnectionError("Connection paused. Select reconnect to try again."); };
    const countChanged = (count: number) => { if (Number.isInteger(count) && count >= 0) setOnlineCount(count); };
    current.on("connect", connected);
    current.on("disconnect", disconnected);
    current.on("connect_error", failed);
    current.on("onlineCount", countChanged);
    current.io.on("reconnect_attempt", retrying);
    current.io.on("reconnect_failed", exhausted);
    return () => {
      current.off("connect", connected);
      current.off("disconnect", disconnected);
      current.off("connect_error", failed);
      current.off("onlineCount", countChanged);
      current.io.off("reconnect_attempt", retrying);
      current.io.off("reconnect_failed", exhausted);
      release(userId);
    };
  }, [isLoaded, userId, accountReady]);

  return { socket, isConnected, connectionError, onlineCount, reconnect: () => { if (userId) connections.get(userId)?.reconnect(); } };
}

export async function emitWithAck<T>(socket: Socket | null, event: string, payload: unknown): Promise<T & { ok: true }> {
  if (!socket?.connected) throw new Error("You are offline. Reconnect and try again.");
  const result = await socket.timeout(12000).emitWithAck(event, payload) as RealtimeAck<T>;
  if (!result?.ok) throw new Error(result?.error?.message || "The request could not be completed.");
  return result;
}
