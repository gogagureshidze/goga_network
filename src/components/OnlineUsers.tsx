"use client";

import React, { useEffect, useState } from "react";
import io, { Socket } from "socket.io-client";
import { Users, Wifi } from "lucide-react";
import { useUser } from "@clerk/nextjs";

const SOCKET_SERVER_URL = "https://socket.goga.network";

const OnlineUsers = () => {
  const { user, isLoaded, isSignedIn } = useUser();
  const [onlineCount, setOnlineCount] = useState<number>(0);

  useEffect(() => {
    if (!isLoaded || !isSignedIn || !user?.id) return;

    console.log("🔌 Connecting to socket with userId:", user.id);

    const socket: Socket = io(SOCKET_SERVER_URL, {
      query: { userId: user.id },
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: Infinity,
    });

    socket.on("connect", () => {
      console.log("✅ Connected to socket server. Socket ID:", socket.id);
    });

    socket.on("onlineCount", (count: number) => {
      console.log("📡 Online count received:", count);
      setOnlineCount(count);
    });

    socket.on("disconnect", () => {
      console.log("❌ Disconnected from socket server");
    });

    return () => {
      socket.disconnect();
    };
  }, [isLoaded, isSignedIn, user?.id]);

  if (!isLoaded) {
    return (
      <div className="p-4 bg-white rounded-lg shadow-md text-sm flex flex-col gap-4 border border-rose-200">
        <div className="flex items-center justify-between font-medium animate-pulse">
          <span className="text-gray-500">Loading...</span>
        </div>
      </div>
    );
  }

  if (!isSignedIn) return null;

  return (
    <div className="p-4 bg-white rounded-lg shadow-md text-sm flex flex-col gap-4 border border-lime-200">
      <div className="flex items-center justify-between font-medium">
        <span className="text-gray-500">Online Now</span>
        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
      </div>

      <div className="flex items-center gap-4 text-gray-700">
        <Users className="w-6 h-6 text-rose-500" />
        <span className="font-bold text-2xl">{onlineCount}</span>
        <span className="text-gray-500">users online</span>
      </div>

      <div className="p-4 bg-rose-50 rounded-lg flex items-center gap-4 border border-rose-100">
        <Wifi className="w-10 h-10 text-orange-400" />
        <div className="flex flex-col gap-1 text-xs">
          <span className="text-gray-700 font-semibold">
            Real-time connection
          </span>
          <span className="text-gray-500">You are seeing live updates.</span>
        </div>
      </div>
    </div>
  );
};

export default OnlineUsers;
