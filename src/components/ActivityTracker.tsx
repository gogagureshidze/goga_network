"use client";

import { useEffect, useRef } from "react";

interface ActivityTrackerProps {
  updateLastActive: () => Promise<{ success: boolean } | void | any>;
}

export default function ActivityTracker({
  updateLastActive,
}: ActivityTrackerProps) {
  const lastUpdateRef = useRef<number>(Date.now());

  // 1. Keep a stable reference to the function to avoid re-renders
  const updateFnRef = useRef(updateLastActive);

  // 2. Always keep the ref updated with the latest function
  useEffect(() => {
    updateFnRef.current = updateLastActive;
  }, [updateLastActive]);

  useEffect(() => {
    const doUpdate = () => {
      // 3. Reset the throttle timer on EVERY update, even the interval
      lastUpdateRef.current = Date.now();

      updateFnRef.current().catch((err: any) => {
        console.error("Failed to update last active status", err);
      });
    };

    // Update on mount
    doUpdate();

    // Update every 2 minutes (120000ms)
    const interval = setInterval(doUpdate, 120000);

    // Throttled activity handler - max once per 30 seconds (30000ms)
    const handleActivity = () => {
      const now = Date.now();
      if (now - lastUpdateRef.current > 30000) {
        doUpdate();
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
  }, []); // <--- 4. THE MAGIC FIX: EMPTY DEPENDENCY ARRAY

  return null;
}
