"use client";
import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import { io, Socket } from "socket.io-client";
import { useUser } from "@clerk/nextjs";

const SOCKET_SERVER_URL = "wss://socket.goga.network";

type SocketContextType = {
  socket: Socket | null;
  isConnected: boolean;
  connectionError: string | null;
};

const SocketContext = createContext<SocketContextType>({
  socket: null,
  isConnected: false,
  connectionError: null,
});

export const useSocket = () => useContext(SocketContext);

export const SocketProvider = ({ children }: { children: ReactNode }) => {
  const { user, isLoaded, isSignedIn } = useUser();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoaded || !isSignedIn || !user?.id) return;

    const s = io(SOCKET_SERVER_URL, {
      transports: ["websocket"],
      path: "/socket.io",
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      withCredentials: true,
      query: { userId: user.id },
    });

    setSocket(s);

    s.on("connect", () => {
      setIsConnected(true);
      setConnectionError(null);
      console.log("Socket connected:", s.id);
      s.emit("authenticate", { userId: user.id });
    });

    s.on("disconnect", (reason) => {
      setIsConnected(false);
      console.log("Socket disconnected:", reason);
    });

    s.on("connect_error", (err: any) => {
      setIsConnected(false);
      setConnectionError(err.message);
      console.error("Socket connect error:", err.message);
    });

    return () => {
      s.disconnect();
    };
  }, [isLoaded, isSignedIn, user?.id]);

  return (
    <SocketContext.Provider value={{ socket, isConnected, connectionError }}>
      {children}
    </SocketContext.Provider>
  );
};
