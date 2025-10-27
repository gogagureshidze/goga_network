"use client";

import { useState, useMemo, useEffect } from "react";
// Correct the import path if necessary based on your project structure
import Image from "next/image";
import { X, ChevronLeft, ChevronRight } from "lucide-react";

interface MediaGridProps {
  media: { type: "photo" | "video"; url: string }[];
}

// Simple spinner component - Themed
const Spinner = () => (
  <div className="absolute inset-0 flex items-center justify-center bg-gray-100/50 dark:bg-gray-700/50 rounded-md z-10">
    <div className="w-6 h-6 border-4 border-orange-400 dark:border-gray-400 border-t-transparent rounded-full animate-spin" />
  </div>
);

export default function MediaGrid({ media }: MediaGridProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);

  // Grid loading states - Initialize based on media type
  const [gridLoadingStates, setGridLoadingStates] = useState<boolean[]>(
    media.map((item) => item.type === "photo")
  );

  // Slider loading states - Use an object for easier updates
  const [sliderLoadingStates, setSliderLoadingStates] = useState<
    Record<number, boolean>
  >({});

  // Only show the first 4 items in the grid preview
  const displayedMedia = useMemo(() => media?.slice(0, 4) || [], [media]);

  // Return null if no media exists
  if (!media || media.length === 0) return null;

  const openSlider = (idx: number) => {
    setCurrentIndex(idx);
    // Initialize loading state for the selected slider image if it's a photo
    if (media[idx]?.type === "photo" && sliderLoadingStates[idx] !== false) {
      setSliderLoadingStates((prev) => ({ ...prev, [idx]: true }));
    }
    setIsOpen(true);
    document.body.style.overflow = "hidden"; // Prevent background scroll
  };

  const closeSlider = () => {
    setIsOpen(false);
    document.body.style.overflow = ""; // Restore background scroll
  };

  // Function to update the current index and manage loading state
  const updateCurrentIndex = (newIndex: number) => {
    setCurrentIndex(newIndex);
    // Preemptively set loading state for the *new* image if it's a photo and might need loading
    if (
      media[newIndex]?.type === "photo" &&
      sliderLoadingStates[newIndex] !== false
    ) {
      setSliderLoadingStates((prev) => ({ ...prev, [newIndex]: true }));
    }
  };

  // Navigation functions for the slider
  const nextSlide = () => updateCurrentIndex((currentIndex + 1) % media.length);
  const prevSlide = () =>
    updateCurrentIndex((currentIndex - 1 + media.length) % media.length);

  // Effect for handling keyboard navigation and cleanup
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isOpen) {
        if (e.key === "ArrowRight") nextSlide();
        if (e.key === "ArrowLeft") prevSlide();
        if (e.key === "Escape") closeSlider();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    // Cleanup function
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = ""; // Ensure scroll is restored on unmount
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, media.length, currentIndex]); // Added currentIndex to ensure next/prevSlide have latest value

  const handleGridLoadComplete = (idx: number) => {
    setGridLoadingStates((prev) => {
      if (!prev[idx]) return prev; // Avoid unnecessary updates
      const newStates = [...prev];
      newStates[idx] = false;
      return newStates;
    });
  };

  const handleSliderLoadComplete = (idx: number) => {
    setSliderLoadingStates((prev) => ({ ...prev, [idx]: false }));
  };

  const handleLoadingError = (
    type: "grid" | "slider",
    index: number,
    url: string
  ) => {
    console.error(`Error loading ${type} media [${index}]: ${url}`);
    if (type === "grid") {
      setGridLoadingStates((prev) => {
        const newStates = [...prev];
        newStates[index] = false; // Stop spinner on error
        return newStates;
      });
    } else {
      setSliderLoadingStates((prev) => ({ ...prev, [index]: false })); // Stop spinner on error
    }
    // Optionally: Visually indicate error on the item
  };

  return (
    <>
      {/* Media Grid - Themed */}
      <div
        className={`grid gap-2 rounded-md overflow-hidden ${
          media.length === 1 ? "grid-cols-1" : "grid-cols-2"
        }`}
      >
        {displayedMedia.map((file, idx) => (
          <div
            key={file.url + "-grid-" + idx} // More unique key
            className="relative w-full aspect-square cursor-pointer group bg-gray-100 dark:bg-gray-800 rounded-md overflow-hidden" // Base bg for loading
            onClick={() => openSlider(idx)}
          >
            {/* Show spinner only for photos that are loading */}
            {file.type === "photo" && gridLoadingStates[idx] && <Spinner />}

            {file.type === "photo" ? (
              <Image
                src={file.url}
                alt={`Media grid item ${idx + 1}`}
                fill
                className={`object-cover transition-opacity duration-300 ${
                  gridLoadingStates[idx] ? "opacity-0" : "opacity-100" // Fade in on load
                }`}
                style={{ imageOrientation: "from-image" }} // Attempt for iOS rotation
                // Refined sizes prop: Assumes 2 columns up to large screens, then potentially more
                sizes="(max-width: 640px) 50vw, (max-width: 1024px) 50vw, 25vw"
                priority={idx < 2} // **OPTIMIZATION**: Prioritize first two images
                quality={75} // Good balance
                onLoadingComplete={() => handleGridLoadComplete(idx)} // **OPTIMIZATION**: Use onLoadingComplete
                onError={() => handleLoadingError("grid", idx, file.url)} // Handle image errors
              />
            ) : (
              // Video specific rendering
              <>
                <video
                  src={file.url + "#t=0.1"} // Hint for thumbnail
                  className="w-full h-full object-cover"
                  preload="metadata"
                  muted
                  playsInline
                  onError={() => handleLoadingError("grid", idx, file.url)} // Handle video errors
                />
                {/* Play icon overlay for videos */}
                <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none">
                  <svg
                    className="w-10 h-10 text-white opacity-80"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
              </>
            )}

            {/* +N overlay - Themed */}
            {idx === 3 && media.length > 4 && (
              <div className="absolute inset-0 bg-black/60 dark:bg-black/70 flex items-center justify-center rounded-md pointer-events-none">
                <span className="text-white text-lg font-semibold">
                  +{media.length - 4}
                </span>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Slider Modal - Themed */}
      {isOpen && (
        // Added fade-in animation to modal itself
        <div
          className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-2 sm:p-4 animate-fadeIn"
          onClick={closeSlider}
        >
          {/* Close Button - Themed */}
          <button
            aria-label="Close media viewer"
            className="absolute top-2 right-2 sm:top-4 sm:right-4 text-white p-2 rounded-full bg-black/40 hover:bg-black/60 z-[51] transition"
            onClick={closeSlider}
          >
            <X size={24} />
          </button>

          {/* Prev/Next Buttons - Themed */}
          {media.length > 1 && (
            <>
              <button
                aria-label="Previous media item"
                className="absolute left-1 sm:left-4 top-1/2 -translate-y-1/2 text-white p-2 rounded-full bg-black/30 hover:bg-black/50 z-[51] transition"
                onClick={(e) => {
                  e.stopPropagation();
                  prevSlide();
                }}
              >
                <ChevronLeft size={32} />
              </button>
              <button
                aria-label="Next media item"
                className="absolute right-1 sm:right-4 top-1/2 -translate-y-1/2 text-white p-2 rounded-full bg-black/30 hover:bg-black/50 z-[51] transition"
                onClick={(e) => {
                  e.stopPropagation();
                  nextSlide();
                }}
              >
                <ChevronRight size={32} />
              </button>
            </>
          )}

          {/* Current Media Container */}
          <div
            className="relative max-w-[95vw] max-h-[90vh] flex items-center justify-center"
            onClick={(e) => e.stopPropagation()} // Prevent closing modal when clicking media
          >
            {/* Spinner for Slider - Themed */}
            {media[currentIndex].type === "photo" &&
              sliderLoadingStates[currentIndex] === true && ( // Check for explicit true
                <div className="absolute inset-0 flex items-center justify-center z-10">
                  <div className="w-10 h-10 border-4 border-white dark:border-gray-300 border-t-transparent rounded-full animate-spin" />
                </div>
              )}

            {media[currentIndex].type === "photo" ? (
              <Image
                // Add key to potentially help React update state correctly on src change
                key={media[currentIndex].url + "-slider"}
                src={media[currentIndex].url}
                alt={`Media slider item ${currentIndex + 1}`}
                width={1200}
                height={1200}
                style={{
                  imageOrientation: "from-image", // Keep attempt for iOS rotation
                  maxWidth: "95vw",
                  maxHeight: "90vh",
                  width: "auto",
                  height: "auto",
                }}
                className={`object-contain transition-opacity duration-300 rounded-md ${
                  // Fade in based on loading state
                  sliderLoadingStates[currentIndex] === true
                    ? "opacity-0"
                    : "opacity-100"
                }`}
                quality={85}
                priority // Always prioritize the current slider image
                onLoadingComplete={() => handleSliderLoadComplete(currentIndex)} // **OPTIMIZATION**: Use onLoadingComplete
                onError={() =>
                  handleLoadingError(
                    "slider",
                    currentIndex,
                    media[currentIndex].url
                  )
                }
              />
            ) : (
              <video
                key={media[currentIndex].url + "-slider"} // Add key here too
                src={media[currentIndex].url}
                controls
                autoPlay
                className="max-w-[95vw] max-h-[90vh] rounded-md"
                preload="auto"
                playsInline
                onError={() =>
                  handleLoadingError(
                    "slider",
                    currentIndex,
                    media[currentIndex].url
                  )
                }
              />
            )}
          </div>
        </div>
      )}
      {/* Basic fade-in animation */}
      <style jsx>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
        .animate-fadeIn {
          animation: fadeIn 0.3s ease-out forwards;
        }
      `}</style>
    </>
  );
}
