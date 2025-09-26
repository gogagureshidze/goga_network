"use client";
import React, { useEffect, useState, useRef } from "react";
import io, { Socket } from "socket.io-client";
import { Users, Wifi, WifiOff } from "lucide-react";
import { useUser } from "@clerk/nextjs";

const SOCKET_SERVER_URL = "wss://socket.goga.network";

const OnlineUsers = () => {
  const { user, isLoaded, isSignedIn } = useUser();
  const [onlineCount, setOnlineCount] = useState<number>(0);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!isLoaded || !isSignedIn || !user?.id) return;

    console.log("OnlineUsers: Connecting to socket with userId:", user.id);

    // Cleanup previous connection if exists
    if (socketRef.current) {
      socketRef.current.disconnect();
    }

    const socket: Socket = io(SOCKET_SERVER_URL, {
      query: { userId: user.id },
      transports: ["websocket"],
      reconnection: true,
      path: "/socket.io", // <--- add this
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      console.log(
        "OnlineUsers: Connected to socket server. Socket ID:",
        socket.id
      );
      setIsConnected(true);
      setConnectionError(null);
    });

    socket.on("onlineCount", (count: number) => {
      console.log("OnlineUsers: Online count received:", count);
      setOnlineCount(count);
    });

    socket.on("connect_error", (error: Error) => {
      console.error("OnlineUsers: Connection error:", error.message);
      setIsConnected(false);
      setConnectionError(error.message);
    });

    socket.on("disconnect", (reason: string) => {
      console.log(
        "OnlineUsers: Disconnected from socket server. Reason:",
        reason
      );
      setIsConnected(false);
      if (reason === "io server disconnect") {
        socket.connect();
      }
    });

    socket.on("reconnect_attempt", (attempt: number) => {
      console.log(`OnlineUsers: Reconnection attempt ${attempt}`);
      setConnectionError(`Reconnecting... (attempt ${attempt})`);
    });

    socket.on("reconnect", (attempt: number) => {
      console.log(`OnlineUsers: Reconnected after ${attempt} attempts`);
      setIsConnected(true);
      setConnectionError(null);
    });

    socket.on("reconnect_failed", () => {
      console.error("OnlineUsers: Reconnection failed");
      setConnectionError("Failed to connect");
    });

    // Cleanup
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [isLoaded, isSignedIn, user?.id]);

  if (!isLoaded) {
    return (
      <div className="p-4 bg-white rounded-lg shadow-md text-sm flex flex-col gap-4 border border-gray-200">
        <div className="flex items-center justify-between font-medium animate-pulse">
          <span className="text-gray-500">Loading...</span>
          <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse" />
        </div>
      </div>
    );
  }

  if (!isSignedIn) return null;

  return (
    <div className="p-4 bg-white rounded-lg shadow-md text-sm flex flex-col gap-4 border border-lime-200">
      <div className="flex items-center justify-between font-medium">
        <span className="text-gray-500">Online Now</span>
        <div
          className={`w-2 h-2 rounded-full ${
            isConnected ? "bg-green-500 animate-pulse" : "bg-red-500"
          }`}
        />
      </div>

      <div className="flex items-center gap-4 text-gray-700">
        <Users className="w-6 h-6 text-rose-500" />
        <span className="font-bold text-2xl">{onlineCount}</span>
        <span className="text-gray-500">
          {onlineCount === 1 ? "user online" : "users online"}
        </span>
      </div>

      <div
        className={`p-4 rounded-lg flex items-center gap-4 border ${
          isConnected
            ? "bg-green-50 border-green-100"
            : "bg-red-50 border-red-100"
        }`}
      >
        {isConnected ? (
          <Wifi className="w-10 h-10 text-green-500" />
        ) : (
          <WifiOff className="w-10 h-10 text-red-500" />
        )}
        <div className="flex flex-col gap-1 text-xs">
          <span className="text-gray-700 font-semibold">
            {isConnected ? "Real-time connection" : "Connection lost"}
          </span>
          <span className="text-gray-500">
            {isConnected
              ? "You are seeing live updates."
              : connectionError || "Attempting to reconnect..."}
          </span>
        </div>
      </div>
    </div>
  );
};

export default OnlineUsers;
