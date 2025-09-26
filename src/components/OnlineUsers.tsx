"use client";
import React, { useEffect, useState } from "react";
import { Users, Wifi, WifiOff } from "lucide-react";
import { useSocket } from "../context/SocketContext";

const OnlineUsers = () => {
  const { socket, isConnected, connectionError } = useSocket();
  const [onlineCount, setOnlineCount] = useState(0);

  useEffect(() => {
    if (!socket) return;

    const handleOnlineCount = (count: number) => setOnlineCount(count);

    socket.on("onlineCount", handleOnlineCount);

    return () => {
      socket.off("onlineCount", handleOnlineCount);
    };
  }, [socket]);

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
