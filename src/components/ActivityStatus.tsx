"use client";

import { useEffect, useState } from "react";

interface ActivityStatusProps {
  lastActiveAt: Date | string;
  size?: "sm" | "md" | "lg";
  showText?: boolean;
}

function isUserOnline(lastActiveAt: Date | string): boolean {
  const now = new Date();
  const diffInMinutes =
    (now.getTime() - new Date(lastActiveAt).getTime()) / 60000;
  return diffInMinutes < 5;
}

function getActivityStatusText(lastActiveAt: Date | string): string {
  const now = new Date();
  const diffInMinutes = Math.floor(
    (now.getTime() - new Date(lastActiveAt).getTime()) / 60000
  );

  if (diffInMinutes < 5) return "Online";
  if (diffInMinutes < 60) return `Active ${diffInMinutes}m ago`;

  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `Active ${diffInHours}h ago`;

  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays === 1) return "Active yesterday";
  if (diffInDays < 7) return `Active ${diffInDays}d ago`;

  return "Active recently";
}

export default function ActivityStatus({
  lastActiveAt,
  size = "md",
  showText = true,
}: ActivityStatusProps) {
  const [statusText, setStatusText] = useState("");
  const [isOnline, setIsOnline] = useState(false);

  useEffect(() => {
    const updateStatus = () => {
      setStatusText(getActivityStatusText(lastActiveAt));
      setIsOnline(isUserOnline(lastActiveAt));
    };

    // Initial check
    updateStatus();

    // Update every minute
    const interval = setInterval(updateStatus, 60000);

    return () => clearInterval(interval);
  }, [lastActiveAt]);

  const sizeClasses = {
    sm: "w-2 h-2",
    md: "w-2.5 h-2.5",
    lg: "w-3 h-3",
  };

  const textSizeClasses = {
    sm: "text-xs",
    md: "text-sm",
    lg: "text-base",
  };

  return (
    <div className="flex items-center gap-1.5">
      <div
        className={`${sizeClasses[size]} rounded-full ${
          isOnline ? "bg-green-500 animate-pulse" : "bg-gray-400"
        }`}
      />
      {showText && (
        <span
          className={`${textSizeClasses[size]} ${
            isOnline ? "text-green-600 font-medium" : "text-gray-500"
          }`}
        >
          {statusText}
        </span>
      )}
    </div>
  );
}
