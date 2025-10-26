"use client";

import { useState, useEffect } from "react";
import { X, Calendar, MapPin, Clock, Sparkles } from "lucide-react";
import EventMap from "./EventMap"; // Assuming EventMap component exists

interface EventPostModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (eventData: EventData, description: string) => void;
}

export interface EventData {
  date: Date;
  endDate?: Date;
  location?: string;
  latitude?: number;
  longitude?: number;
}

const EventPostModal: React.FC<EventPostModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
}) => {
  const [desc, setDesc] = useState("");
  const [startDate, setStartDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endDate, setEndDate] = useState("");
  const [endTime, setEndTime] = useState("");
  const [location, setLocation] = useState("");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(
    null
  );
  const [locationType, setLocationType] = useState<"current" | "future">(
    "future"
  );
  const [daysUntil, setDaysUntil] = useState<string>("");
  const [duration, setDuration] = useState<string>("");

  // Calculate days until event
  useEffect(() => {
    if (startDate) {
      const now = new Date();
      // Ensure date is parsed correctly, considering timezone potentially
      const eventStart = new Date(startDate + "T00:00:00"); // Set time to midnight to avoid timezone issues with just date
      const diffTime = eventStart.getTime() - now.setHours(0, 0, 0, 0); // Compare dates only
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays < 0) {
        setDaysUntil("Event date has passed");
      } else if (diffDays === 0) {
        setDaysUntil("Today");
      } else if (diffDays === 1) {
        setDaysUntil("Tomorrow");
      } else if (diffDays < 7) {
        setDaysUntil(`In ${diffDays} days`);
      } else if (diffDays < 30) {
        const weeks = Math.floor(diffDays / 7);
        setDaysUntil(`In ${weeks} week${weeks > 1 ? "s" : ""}`);
      } else if (diffDays < 365) {
        const months = Math.floor(diffDays / 30);
        setDaysUntil(`In ${months} month${months > 1 ? "s" : ""}`);
      } else {
        const years = Math.floor(diffDays / 365);
        setDaysUntil(`In ${years} year${years > 1 ? "s" : ""}`);
      }
    } else {
      setDaysUntil("");
    }
  }, [startDate]);

  // Calculate duration when dates change
  useEffect(() => {
    if (startDate && startTime && endDate && endTime) {
      // Use UTC parsing to avoid timezone shifts if times are meant to be local
      const start = new Date(`${startDate}T${startTime}`);
      const end = new Date(`${endDate}T${endTime}`);
      const diffMs = end.getTime() - start.getTime();

      if (diffMs <= 0) {
        setDuration("Invalid duration");
        return;
      }

      const totalMinutes = Math.floor(diffMs / (1000 * 60));
      const totalHours = Math.floor(totalMinutes / 60);
      const days = Math.floor(totalHours / 24);
      const hours = totalHours % 24;
      const minutes = totalMinutes % 60;

      let durationStr = "";
      if (days > 0) {
        durationStr += `${days}d `;
      }
      if (hours > 0) {
        durationStr += `${hours}h `;
      }
      if (minutes > 0 || durationStr === "") {
        // Show minutes if it's the only unit or > 0
        durationStr += `${minutes}m`;
      }

      setDuration(durationStr.trim());
    } else {
      setDuration(""); // Reset if any input is missing
    }
  }, [startDate, startTime, endDate, endTime]);

  if (!isOpen) return null;

  const handleLocationSelect = (
    selectedCoords: { lat: number; lng: number },
    address: string
  ) => {
    setCoords(selectedCoords);
    setLocation(address);
  };

  const handleSubmit = () => {
    if (!desc.trim()) {
      alert("Please write a description for your event");
      return;
    }

    if (!startDate || !startTime) {
      alert("Please select a start date and time");
      return;
    }

    const startDateTime = new Date(`${startDate}T${startTime}`);
    const endDateTime =
      endDate && endTime ? new Date(`${endDate}T${endTime}`) : undefined;

    if (endDateTime && endDateTime <= startDateTime) {
      alert("End date must be after start date");
      return;
    }

    const eventData: EventData = {
      date: startDateTime,
      endDate: endDateTime,
      location: location || undefined,
      latitude: coords?.lat,
      longitude: coords?.lng,
    };

    onSubmit(eventData, desc);

    // Reset form after successful submission (or move inside onSubmit if preferred)
    setDesc("");
    setStartDate("");
    setStartTime("");
    setEndDate("");
    setEndTime("");
    setLocation("");
    setCoords(null);
    setDuration("");
    setDaysUntil("");
  };

  const handleClose = () => {
    // Reset form fields when closing the modal
    setDesc("");
    setStartDate("");
    setStartTime("");
    setEndDate("");
    setEndTime("");
    setLocation("");
    setCoords(null);
    setDuration("");
    setDaysUntil("");
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col transition-colors duration-300">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-purple-500 via-pink-500 to-rose-500 dark:bg-gradient-to-r dark:from-gray-700 dark:via-gray-800 dark:to-gray-800 p-6 flex justify-between items-center">
          <h2 className="text-2xl font-bold text-white flex items-center gap-3">
            <Sparkles className="w-7 h-7" />
            Create Amazing Event
          </h2>
          <button
            onClick={handleClose}
            className="text-white hover:bg-white/20 dark:hover:bg-gray-600 rounded-full p-2 transition-all duration-200 hover:rotate-90"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Scrollable Content Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Description Section */}
          <div className="bg-indigo-50 dark:bg-gray-700/50 rounded-xl p-5 border border-indigo-200 dark:border-gray-600 shadow-sm transition-colors duration-300">
            <label className="block text-sm font-semibold text-gray-800 dark:text-white mb-2">
              Whats happening?
            </label>
            <textarea
              value={desc}
              onChange={(e) => {
                if (e.target.value.length <= 2000) {
                  setDesc(e.target.value);
                }
              }}
              placeholder="Describe your event... Make it exciting!"
              className="w-full p-4 border-2 border-indigo-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-indigo-400 dark:focus:ring-gray-500 focus:border-transparent transition-all resize-none h-32 bg-white/80 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400"
            />
            <div className="flex justify-end mt-2">
              <span
                className={`text-xs font-medium ${
                  desc.length > 1800
                    ? "text-rose-500 dark:text-rose-400" // Keep rose color for warning
                    : "text-gray-500 dark:text-gray-400"
                }`}
              >
                {desc.length}/2000
              </span>
            </div>
          </div>

          {/* Date & Time Section */}
          <div className="bg-purple-50 dark:bg-gray-700/50 rounded-xl p-5 border border-purple-200 dark:border-gray-600 shadow-sm transition-colors duration-300">
            <div className="flex items-center gap-2 mb-4">
              <Clock className="w-5 h-5 text-purple-600 dark:text-gray-400" />
              <h3 className="font-semibold text-gray-800 dark:text-white">
                When
              </h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Start Date & Time */}
              <div className="space-y-3">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Start Date & Time
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full p-3 border-2 border-purple-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-400 dark:focus:ring-gray-500 focus:border-transparent transition-all bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  style={{ colorScheme: "dark" }} // Apply color scheme hint
                />
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full p-3 border-2 border-purple-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-400 dark:focus:ring-gray-500 focus:border-transparent transition-all bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  style={{ colorScheme: "dark" }} // Apply color scheme hint
                />
              </div>

              {/* End Date & Time */}
              <div className="space-y-3">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  End Date & Time (Optional)
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full p-3 border-2 border-pink-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-pink-400 dark:focus:ring-gray-500 focus:border-transparent transition-all bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  style={{ colorScheme: "dark" }} // Apply color scheme hint
                />
                <input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="w-full p-3 border-2 border-pink-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-pink-400 dark:focus:ring-gray-500 focus:border-transparent transition-all bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  style={{ colorScheme: "dark" }} // Apply color scheme hint
                />
              </div>
            </div>
            {/* Info Boxes */}
            <div className="mt-4 space-y-2">
              {daysUntil && (
                <div className="p-3 bg-gradient-to-r from-blue-100 to-cyan-100 dark:bg-gray-700 rounded-lg border-2 border-blue-300 dark:border-gray-600">
                  <p className="text-sm font-semibold text-blue-800 dark:text-gray-200 flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    Event starts:{" "}
                    <span className="text-cyan-700 dark:text-gray-300">
                      {daysUntil}
                    </span>
                  </p>
                </div>
              )}

              {duration && (
                <div className="p-3 bg-gradient-to-r from-purple-100 to-pink-100 dark:bg-gray-700 rounded-lg border-2 border-purple-300 dark:border-gray-600">
                  <p className="text-sm font-semibold text-purple-800 dark:text-gray-200 flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    Duration:{" "}
                    <span className="text-pink-600 dark:text-gray-300">
                      {duration}
                    </span>
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Location Section */}
          <div className="bg-blue-50 dark:bg-gray-700/50 rounded-xl p-5 border border-blue-200 dark:border-gray-600 shadow-sm transition-colors duration-300">
            <div className="flex items-center gap-2 mb-4">
              <MapPin className="w-5 h-5 text-blue-600 dark:text-gray-400" />
              <h3 className="font-semibold text-gray-800 dark:text-white">
                Where
              </h3>
            </div>

            {/* CORRECTED BUTTONS - No scale/shadow on active, consistent border */}
<div className="flex gap-3 mb-4">
  <button
    onClick={() => setLocationType("current")}
    className={`flex-1 py-3 px-4 rounded-xl font-medium transition-colors duration-200 border-2 ${
      locationType === "current"
        ? "bg-gradient-to-r from-blue-500 to-blue-600 text-white dark:from-gray-600 dark:to-gray-700 dark:text-white border-transparent"
        : "bg-white text-gray-600 hover:bg-blue-50 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600 border-blue-200 dark:border-gray-600"
    }`}
  >
    Current Location
  </button>
  <button
    onClick={() => setLocationType("future")}
    className={`flex-1 py-3 px-4 rounded-xl font-medium transition-colors duration-200 border-2 ${
      locationType === "future"
        ? "bg-gradient-to-r from-cyan-500 to-cyan-600 text-white dark:from-gray-600 dark:to-gray-700 dark:text-white border-transparent"
        : "bg-white text-gray-600 hover:bg-cyan-50 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600 border-cyan-200 dark:border-gray-600"
    }`}
  >
    Search Location
  </button>
</div>


            <div className="transform transition-all duration-300">
              {/* EventMap will need its own dark mode styles passed via props or context if necessary */}
              <EventMap
                locationType={locationType}
                onSelectLocation={handleLocationSelect}
              />
            </div>
          </div>
        </div>

        {/* Footer Buttons */}
        <div className="sticky bottom-0 bg-gradient-to-r from-gray-50 to-gray-100 dark:bg-gradient-to-r dark:from-gray-800 dark:to-gray-900 p-6 flex gap-3 border-t-2 border-gray-200 dark:border-gray-700 transition-colors duration-300">
          <button
            onClick={handleClose}
            className="flex-1 py-3 px-6 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-xl font-semibold hover:bg-gray-100 dark:hover:bg-gray-600 transition-all duration-200 border-2 border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            className="flex-1 py-3 px-6 bg-gradient-to-r from-purple-500 via-pink-500 to-rose-500 dark:bg-gradient-to-r dark:from-gray-600 dark:via-gray-700 dark:to-gray-700 text-white rounded-xl font-semibold hover:from-purple-600 hover:via-pink-600 hover:to-rose-600 dark:hover:from-gray-700 dark:hover:via-gray-700 dark:hover:to-gray-800 shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105"
          >
            Create Event
          </button>
        </div>
      </div>
    </div>
  );
};

export default EventPostModal;
