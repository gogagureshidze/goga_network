"use client";
import React from "react";
import { useRealtimeSocket } from "@/hooks/useRealtimeSocket";
import { Users, Wifi, WifiOff } from "lucide-react";
import { useUser } from "@clerk/nextjs";

const OnlineUsers = () => {
  const { isLoaded, isSignedIn } = useUser();
  const { onlineCount, isConnected, connectionError, reconnect } = useRealtimeSocket();

  if (!isLoaded) {
    return (
      <div className="p-4 bg-white rounded-lg shadow-md text-sm flex flex-col gap-4 border border-gray-200 dark:bg-gray-800 dark:border-gray-700">
        <div className="flex items-center justify-between font-medium animate-pulse">
          <span className="text-gray-500 dark:text-gray-400">Loading...</span>
          <div className="w-2 h-2 bg-gray-400 dark:bg-gray-600 rounded-full animate-pulse" />
        </div>
      </div>
    );
  }

  if (!isSignedIn) return null;

  return (
    <div className="p-4 bg-white rounded-lg shadow-md text-sm flex flex-col gap-4 border border-lime-200 dark:bg-gray-800 dark:border-gray-700 transition-colors duration-300">
      <div className="flex items-center justify-between font-medium">
        <span className="text-gray-500 dark:text-gray-400">Online Now</span>
        <div
          className={`w-2 h-2 rounded-full ${
            isConnected ? "bg-green-500 animate-pulse" : "bg-red-500"
          }`}
        />
      </div>

      <div className="flex items-center gap-4 text-gray-700 dark:text-gray-200">
        <Users className="w-6 h-6 text-rose-500 dark:text-gray-400" />
        <span className="font-bold text-2xl">{onlineCount}</span>
        <span className="text-gray-500 dark:text-gray-400">
          {onlineCount === 1 ? "user online" : "users online"}
        </span>
      </div>

      <div
        className={`p-4 rounded-lg flex items-center gap-4 border ${
          isConnected
            ? "bg-green-50 border-green-100 dark:bg-gray-700/50 dark:border-gray-600"
            : "bg-red-50 border-red-100 dark:bg-gray-700/50 dark:border-gray-600"
        }`}
      >
        {isConnected ? (
          <Wifi className="w-10 h-10 text-green-500" />
        ) : (
          <WifiOff className="w-10 h-10 text-red-500" />
        )}
        <div className="flex flex-col gap-1 text-xs">
          <span className="text-gray-700 font-semibold dark:text-white">
            {isConnected ? "Real-time connection" : "Connection lost"}
          </span>
          <span
            className={
              isConnected
                ? "text-gray-500 dark:text-gray-400"
                : "text-gray-500 dark:text-red-400"
            }
          >
            {isConnected
              ? "You are seeing live updates."
              : connectionError || "Attempting to reconnect..."}
          </span>
        </div>
      </div>
      {!isConnected && <button onClick={reconnect} className="text-sm text-orange-600 dark:text-orange-400">Reconnect</button>}
    </div>
  );
};

export default OnlineUsers;
