"use client";

import { useState, useEffect } from "react";
import Greet from "@/components/Greet";

export default function WeatherToggleWrapper({
  userName,
}: {
  userName?: string;
}) {
  const [showWeather, setShowWeather] = useState<boolean | null>(null);

  // Load preference from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem("showWeather");
    if (saved !== null) {
      setShowWeather(saved === "true");
    } else {
      setShowWeather(true); // default to visible if not set
    }
  }, []);

  // Save preference to localStorage when toggled
  useEffect(() => {
    if (showWeather !== null) {
      localStorage.setItem("showWeather", String(showWeather));
    }
  }, [showWeather]);

  // Don't render until localStorage value is loaded
  if (showWeather === null) {
    return null;
  }

  return (
    <div className="space-y-3">
      {/* Compact toggle button */}
      <div className="flex justify-between items-center gap-2 bg-white p-3 rounded-lg shadow-md dark:bg-gray-800 transition-colors duration-300">
        <label
          className="
            text-sm sm:text-base font-bold tracking-wide
            bg-gradient-to-r from-orange-500 via-rose-600 to-rose-800
            bg-clip-text text-transparent
            dark:bg-none dark:text-white
            filter drop-shadow-sm
          "
        >
          Show Weather
        </label>
        <button
          onClick={() => setShowWeather((prev) => !prev)}
          className={`px-3 py-1.5 text-sm rounded-lg font-semibold transition-all ${
            showWeather
              ? "bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-purple-600 hover:to-pink-600 text-white dark:bg-gray-600 dark:hover:bg-gray-500 dark:text-white"
              : "bg-gray-300 hover:bg-gray-400 text-gray-800 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-gray-200"
          }`}
        >
          {showWeather ? "Hide" : "Show"}
        </button>
      </div>

      {/* Weather or greeting */}
      {showWeather && <Greet userName={userName} />}
    </div>
  );
}
