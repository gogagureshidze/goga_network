"use client";

import { useEffect, useRef } from "react";

interface ActivityTrackerProps {
  updateLastActive: () => Promise<{ success: boolean }>;
}

export default function ActivityTracker({
  updateLastActive,
}: ActivityTrackerProps) {
  const lastUpdateRef = useRef<number>(Date.now());

  useEffect(() => {
    // A simple function to wrap the call
    const doUpdate = () => {
      updateLastActive().catch((err) => {
        console.error("Failed to update last active status", err);
      });
    };

    // Update on mount
    doUpdate();

    // Update every 2 minutes
    const interval = setInterval(doUpdate, 120000);

    // Throttled activity handler - max once per 30 seconds
    const handleActivity = () => {
      const now = Date.now();
      if (now - lastUpdateRef.current > 30000) {
        doUpdate();
        lastUpdateRef.current = now;
      }
    };

    // Listen to user interactions
    window.addEventListener("mousemove", handleActivity);
    window.addEventListener("keydown", handleActivity);
    window.addEventListener("click", handleActivity);
    window.addEventListener("scroll", handleActivity);

    return () => {
      clearInterval(interval);
      window.removeEventListener("mousemove", handleActivity);
      window.removeEventListener("keydown", handleActivity);
      window.removeEventListener("click", handleActivity);
      window.removeEventListener("scroll", handleActivity);
    };
  }, [updateLastActive]);

  return null;
}
