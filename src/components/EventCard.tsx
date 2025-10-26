"use client";

import { Calendar, MapPin, Clock, ArrowRight } from "lucide-react";
import { useState } from "react";

interface EventCardProps {
  event: {
    date: Date;
    endDate?: Date | null;
    location?: string | null;
    latitude?: number | null;
    longitude?: number | null;
  };
}

export default function EventCard({ event }: EventCardProps) {
  const [showMap, setShowMap] = useState(false);

  const getDaysUntil = () => {
    const now = new Date();
    const eventDate = new Date(event.date);
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()); // Start of today
    const diffTime = eventDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    if (diffDays < 0) return "Event has passed";
    if (diffDays === 0) return "Today!";
    if (diffDays === 1) return "Tomorrow";
    return `In ${diffDays} day${diffDays > 1 ? "s" : ""}`;
  };

  const getDuration = () => {
    if (!event.endDate) return null;
    const start = new Date(event.date);
    const end = new Date(event.endDate);
    const diffMs = end.getTime() - start.getTime();
    if (diffMs <= 0) return null;
    const totalMinutes = Math.floor(diffMs / (1000 * 60));
    const totalHours = Math.floor(totalMinutes / 60);
    const days = Math.floor(totalHours / 24);
    const hours = totalHours % 24;
    const minutes = totalMinutes % 60;
    let duration = "";
    if (days > 0) duration += `${days}d `;
    if (hours > 0) duration += `${hours}h `;
    if (minutes > 0 || duration === "") duration += `${minutes}m`;
    return duration.trim();
  };

  const formatMonth = (date: Date) => {
    return new Date(date).toLocaleDateString("en-US", { month: "short" });
  };
  const formatDayOfWeek = (date: Date) => {
    return new Date(date).toLocaleDateString("en-US", { weekday: "short" });
  };
  const formatDayOfMonth = (date: Date) => {
    return new Date(date).getDate();
  };
  const formatTime = (date: Date) => {
    return new Date(date).toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  const formatDateRange = () => {
    const start = new Date(event.date);
    const end = new Date(event.endDate || event.date);
    const isSameDay =
      start.getFullYear() === end.getFullYear() &&
      start.getMonth() === end.getMonth() &&
      start.getDate() === end.getDate();

    const startMonth = formatMonth(start);
    const endMonth = formatMonth(end);

    if (isSameDay) {
      return (
        <>
          <span className="block text-4xl font-extrabold text-orange-500 dark:text-white">
            {formatDayOfMonth(start)}
          </span>
          <span className="block text-sm font-semibold text-gray-600 dark:text-gray-400 uppercase mt-1">
            {startMonth}
          </span>
        </>
      );
    } else if (startMonth === endMonth) {
      return (
        <>
          <span className="block text-4xl font-extrabold text-orange-500 dark:text-white">
            {formatDayOfMonth(start)} - {formatDayOfMonth(end)}
          </span>
          <span className="block text-sm font-semibold text-gray-600 dark:text-gray-400 uppercase mt-1">
            {startMonth}
          </span>
        </>
      );
    } else {
      return (
        <>
          <span className="block text-lg font-bold text-gray-800 dark:text-white">
            {formatMonth(start)} {formatDayOfMonth(start)}
          </span>
          <span className="block text-lg font-bold text-gray-800 dark:text-white">
            <ArrowRight className="inline-block w-4 h-4 mr-1 text-gray-500 dark:text-gray-400" />
            {formatMonth(end)} {formatDayOfMonth(end)}
          </span>
        </>
      );
    }
  };

  const daysUntil = getDaysUntil();
  const duration = getDuration();

  return (
    <div className="relative overflow-hidden bg-gradient-to-r from-orange-50 to-rose-50 dark:bg-gradient-to-r dark:from-gray-800 dark:to-gray-900 rounded-2xl p-6 border border-orange-200 dark:border-gray-700 shadow-xl transition-colors duration-300">
      {/* Background decoration - LOWER z-index - Themed */}
      <div className="absolute top-0 right-0 w-24 h-24 bg-orange-200 dark:bg-gray-700 rounded-full -translate-y-1/2 translate-x-1/2 opacity-50 dark:opacity-20 blur-xl z-0 transition-colors duration-300"></div>

      {/* Content - HIGHER z-index */}
      <div className="relative z-10">
        {/* Header Section - Themed */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="bg-orange-400 dark:bg-gray-600 p-2 rounded-full shadow-md transition-colors duration-300">
              <Calendar className="w-5 h-5 text-white" />
            </div>
            <p className="text-xl font-bold text-orange-600 dark:text-white">
              Event Details
            </p>
          </div>
          <span className="inline-block px-4 py-1 text-sm font-semibold rounded-full bg-orange-100 dark:bg-gray-700 text-orange-600 dark:text-gray-200 border border-orange-300 dark:border-gray-600 shadow-sm transition-colors duration-300">
            {daysUntil}
          </span>
        </div>

        {/* Date & Time - Themed */}
        <div className="flex items-center gap-4 p-4 rounded-xl bg-white dark:bg-gray-700/50 border-2 border-orange-200 dark:border-gray-600 shadow-lg mb-4 transition-colors duration-300">
          <div className="flex-1 text-center">{formatDateRange()}</div>
          <div className="flex-1 flex flex-col items-center">
            <span className="block text-lg font-bold text-gray-800 dark:text-white">
              {formatDayOfWeek(event.date)}
              {event.endDate &&
                new Date(event.date).getDate() !==
                  new Date(event.endDate).getDate() && (
                  <span className="text-sm text-gray-500 dark:text-gray-400 ml-1">
                    - {formatDayOfWeek(event.endDate)}
                  </span>
                )}
            </span>
            <span className="block text-sm text-gray-700 dark:text-gray-300 mt-1">
              {formatTime(event.date)}
              {event.endDate && ` - ${formatTime(event.endDate)}`}
            </span>
          </div>
        </div>

        {/* Location Section - Themed */}
        {event.location && (
          <div className="flex items-center gap-3 p-3 rounded-lg bg-white dark:bg-gray-700/50 border border-gray-100 dark:border-gray-600 shadow-sm mb-4 transition-colors duration-300">
            <MapPin className="w-5 h-5 text-purple-500 dark:text-gray-400 flex-shrink-0" />
            <span className="text-sm font-medium text-gray-800 dark:text-gray-200">
              {event.location}
            </span>
          </div>
        )}

        {/* Duration - Themed */}
        {duration && (
          <div className="flex items-center gap-2 text-sm font-medium text-gray-600 dark:text-gray-400 transition-colors duration-300">
            <Clock className="w-4 h-4 text-gray-500 dark:text-gray-500" />
            <span>Duration: {duration}</span>
          </div>
        )}

        {/* Map Section - Themed */}
        {event.latitude && event.longitude && (
          <div className="mt-6">
            <button
              onClick={() => setShowMap(!showMap)}
              className="flex items-center gap-2 text-sm text-blue-500 dark:text-gray-300 font-medium hover:underline mb-2 transition"
            >
              <ArrowRight className="w-4 h-4" />
              {showMap ? "Hide Map" : "Show on Map"}
            </button>
            {showMap && (
              <div className="w-full h-64 rounded-xl overflow-hidden shadow-inner border-2 border-gray-200 dark:border-gray-600 transition-colors duration-300">
                {/* NOTE: The iframe content (OpenStreetMap) itself cannot be styled by Tailwind dark mode */}
                <iframe
                  width="100%"
                  height="100%"
                  frameBorder="0"
                  style={{ border: 0 }}
                  src={`https://www.openstreetmap.org/export/embed.html?bbox=${
                    event.longitude - 0.01
                  },${event.latitude - 0.01},${event.longitude + 0.01},${
                    event.latitude + 0.01
                  }&layer=mapnik&marker=${event.latitude},${event.longitude}`}
                  allowFullScreen
                  // Consider adding title attribute for accessibility
                  title={`Map showing event location at ${
                    event.location || "coordinates"
                  }`}
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
