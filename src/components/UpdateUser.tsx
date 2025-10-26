"use client";

import UpdateProfile from "@/actions/updateProfile";
import { User } from "@/generated/prisma";
import Image from "next/image";
import { useState, useEffect } from "react";
import { CldUploadWidget } from "next-cloudinary";
import UpdateButton from "./UpdateButton"; // Assuming this is themed or uses theme-agnostic styles
import PatternSelector from "./PatternSelector"; // Assuming this is themed
import allPatterns from "../actions/allPaterns"; // Changed from '../actions/allPaterns'

function UpdateUser({ user }: { user: User }) {
  const [open, setOpen] = useState(false);
  const [cover, setCover] = useState<any>();
  const [selectedPattern, setSelectedPattern] = useState(
    user.bioPattern || allPatterns[0].id
  );
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error";
  } | null>(null);

  useEffect(() => {
    // Prevent body scroll when modal is open
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    // Cleanup function to reset overflow on unmount
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const handleClose = () => {
    // Reset temporary state when the modal is closed without saving
    setCover(undefined);
    setSelectedPattern(user.bioPattern || allPatterns[0].id);
    setOpen(false);
  };

  const handleUploadSuccess = (result: any) => {
    if (result?.info?.secure_url) {
      setCover(result.info);
      setToast({
        message: "Image uploaded! Press 'Update' to save changes.", // Updated message
        type: "success",
      });
    } else {
      setToast({ message: "Upload failed!", type: "error" });
    }
    // Auto-dismiss toast after a delay
    setTimeout(() => setToast(null), 6000);
  };

  const handleSubmit = async (formData: FormData) => {
    try {
      // Pass the potentially updated cover URL and pattern ID
      await UpdateProfile(formData, cover?.secure_url, selectedPattern);

      setToast({
        message: "Profile updated successfully!",
        type: "success",
      });

      // Close modal after a short delay on success
      setTimeout(() => {
        setOpen(false);
        // Optionally trigger a page refresh or re-fetch user data here
      }, 800); // Give user time to see success

      // Clear toast after another delay
      setTimeout(() => {
        setToast(null);
      }, 3000);
    } catch (error: any) {
      console.error("UpdateProfile error:", error);
      setToast({
        message: error?.message || "Update failed! Please try again.",
        type: "error",
      });
      // Keep toast longer for errors
      setTimeout(() => setToast(null), 5000);
    }
  };

  return (
    <div className="z-[9999]">
      {/* Update Trigger Link - Themed */}
      <span
        className="text-orange-400 dark:text-orange-500 text-sm cursor-pointer hover:underline"
        onClick={() => setOpen(true)}
      >
        Update
      </span>

      {/* Modal Overlay & Content - Themed */}
      {open && (
        <div className="fixed w-screen h-screen top-0 left-0 bg-black/50 dark:bg-black/70 z-[9999] flex items-center justify-center p-4">
          <form
            className="p-8 relative bg-white dark:bg-gray-800 rounded-lg shadow-md flex flex-col gap-6 w-full md:w-2/3 xl:w-1/2 max-h-[90vh] overflow-y-auto transition-colors duration-300"
            onSubmit={async (e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              await handleSubmit(formData);
            }}
          >
            {/* Modal Header - Themed */}
            <h1 className="text-lg font-bold text-gray-900 dark:text-white">
              Update Profile
            </h1>

            {/* Cover Image Preview */}
            <div className="relative w-full h-[120px] sm:h-[150px] min-h-[100px] overflow-hidden rounded-md bg-gray-200 dark:bg-gray-700">
              <Image
                src={cover?.secure_url || user.cover || "/noCover.png"}
                alt="Cover Preview"
                fill
                className="object-cover"
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw" // Added sizes for optimization
                priority // Load cover image quickly
                onError={(e) => {
                  e.currentTarget.src = "/noCover.png";
                }} // Fallback for broken images
              />
            </div>

            {/* Avatar/Username Note - Themed */}
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-[-1rem]">
              {" "}
              {/* Reduced top margin */}
              Use the navbar profile icon to update your avatar or username.
            </div>

            {/* Cloudinary Upload Widget */}
            <CldUploadWidget
              uploadPreset="social" // Make sure this preset exists in your Cloudinary account
              options={{
                multiple: false,
                resourceType: "image",
                clientAllowedFormats: ["jpg", "jpeg", "png", "gif", "webp"],
                maxFileSize: 5 * 1024 * 1024, // Example: 5MB limit
              }}
              onSuccess={handleUploadSuccess}
              onError={(error) => {
                // Added error handling
                console.error("Cloudinary upload error:", error);
                setToast({ message: "Image upload failed!", type: "error" });
                setTimeout(() => setToast(null), 5000);
              }}
            >
              {({ open }) => {
                return (
                  <div className="flex flex-col gap-2">
                    {/* Label - Themed */}
                    <label className="text-xs text-gray-500 dark:text-gray-400">
                      Cover Picture
                    </label>
                    <div
                      className="flex items-center gap-3 cursor-pointer"
                      onClick={() => open()}
                    >
                      {/* Change Link - Themed */}
                      <span className="text-sm underline text-orange-400 dark:text-orange-500 hover:text-orange-600 dark:hover:text-orange-400">
                        Change
                      </span>
                    </div>
                  </div>
                );
              }}
            </CldUploadWidget>

            {/* Pattern Selector - Assuming it's themed */}
            <PatternSelector
              onSelect={setSelectedPattern}
              selectedPatternId={selectedPattern}
            />

            {/* Form Inputs Grid - Themed */}
            <div className="flex flex-wrap gap-4">
              {/* First Name */}
              <div className="flex flex-col flex-1 min-w-[45%]">
                <label className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                  First Name
                </label>
                <input
                  type="text"
                  placeholder={user.name || "John"}
                  className="ring-1 ring-gray-300 dark:ring-gray-600 p-[13px] rounded-md text-sm text-black dark:text-white bg-white dark:bg-gray-700 focus:ring-orange-400 dark:focus:ring-orange-500 focus:outline-none transition-all duration-200"
                  name="name"
                  defaultValue={user.name || ""} // Use defaultValue for uncontrolled inputs if needed
                />
              </div>

              {/* Surname */}
              <div className="flex flex-col flex-1 min-w-[45%]">
                <label className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                  Surname
                </label>
                <input
                  type="text"
                  placeholder={user.surname || "Doe"}
                  className="ring-1 ring-gray-300 dark:ring-gray-600 p-[13px] rounded-md text-sm text-black dark:text-white bg-white dark:bg-gray-700 focus:ring-orange-400 dark:focus:ring-orange-500 focus:outline-none transition-all duration-200"
                  name="surname"
                  defaultValue={user.surname || ""}
                />
              </div>

              {/* Description */}
              <div className="flex flex-col flex-1 min-w-[45%]">
                <label className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                  Description
                </label>
                <input
                  type="text"
                  name="description"
                  placeholder={user.description || "Life is beautiful..."} // Changed placeholder
                  className="ring-1 ring-gray-300 dark:ring-gray-600 p-[13px] rounded-md text-sm text-black dark:text-white bg-white dark:bg-gray-700 focus:ring-orange-400 dark:focus:ring-orange-500 focus:outline-none transition-all duration-200"
                  defaultValue={user.description || ""}
                />
              </div>

              {/* City */}
              <div className="flex flex-col flex-1 min-w-[45%]">
                <label className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                  City
                </label>
                <input
                  name="city"
                  type="text"
                  placeholder={user.city || "London"}
                  className="ring-1 ring-gray-300 dark:ring-gray-600 p-[13px] rounded-md text-sm text-black dark:text-white bg-white dark:bg-gray-700 focus:ring-orange-400 dark:focus:ring-orange-500 focus:outline-none transition-all duration-200"
                  defaultValue={user.city || ""}
                />
              </div>

              {/* School */}
              <div className="flex flex-col flex-1 min-w-[45%]">
                <label className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                  School
                </label>
                <input
                  name="school"
                  type="text"
                  placeholder={user.school || "University of Arts"} // Changed placeholder
                  className="ring-1 ring-gray-300 dark:ring-gray-600 p-[13px] rounded-md text-sm text-black dark:text-white bg-white dark:bg-gray-700 focus:ring-orange-400 dark:focus:ring-orange-500 focus:outline-none transition-all duration-200"
                  defaultValue={user.school || ""}
                />
              </div>

              {/* Work */}
              <div className="flex flex-col flex-1 min-w-[45%]">
                <label className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                  Work
                </label>
                <input
                  type="text"
                  name="work"
                  placeholder={user.work || "Goga_Network Inc."}
                  className="ring-1 ring-gray-300 dark:ring-gray-600 p-[13px] rounded-md text-sm text-black dark:text-white bg-white dark:bg-gray-700 focus:ring-orange-400 dark:focus:ring-orange-500 focus:outline-none transition-all duration-200"
                  defaultValue={user.work || ""}
                />
              </div>

              {/* Website */}
              <div className="flex flex-col flex-1 min-w-[45%]">
                <label className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                  Website
                </label>
                <input
                  type="text"
                  name="website"
                  placeholder={user.website || "goga_net.com"}
                  className="ring-1 ring-gray-300 dark:ring-gray-600 p-[13px] rounded-md text-sm text-black dark:text-white bg-white dark:bg-gray-700 focus:ring-orange-400 dark:focus:ring-orange-500 focus:outline-none transition-all duration-200"
                  defaultValue={user.website || ""}
                />
              </div>
            </div>

            {/* Action Buttons - Themed */}
            <div className="flex justify-end gap-4 mt-4">
              {" "}
              {/* Added top margin */}
              <button
                type="button"
                onClick={handleClose}
                className="px-4 py-2 text-sm bg-gray-300 dark:bg-gray-600 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-400 dark:hover:bg-gray-500 transition-colors"
              >
                Cancel
              </button>
              <UpdateButton />{" "}
              {/* Assuming this button handles its own state/styling */}
            </div>

            {/* Close Icon - Themed */}
            <button /* Changed to button for better accessibility */
              type="button"
              className="cursor-pointer absolute text-xl top-3 right-3 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 z-10 p-1" // Added padding for easier click
              onClick={handleClose}
              aria-label="Close modal" // Accessibility label
            >
              ✕
            </button>

            {/* Toast Notification - Themed */}
            {toast && (
              <div
                className={`fixed bottom-5 left-1/2 transform -translate-x-1/2 px-4 py-2 rounded-md text-white font-medium shadow-lg ${
                  toast.type === "success"
                    ? "bg-green-500 dark:bg-green-600"
                    : "bg-red-500 dark:bg-red-600"
                }`}
              >
                {toast.message}
              </div>
            )}
          </form>
        </div>
      )}
    </div>
  );
}

export default UpdateUser;
