"use client";

import { useState, useMemo } from "react";
import Image from "next/image";
import { X, ChevronLeft, ChevronRight } from "lucide-react";

interface MediaGridProps {
  media: { type: "photo" | "video"; url: string }[];
}

// Simple spinner component
const Spinner = () => (
  <div className="relative w-[120px] h-[160px] mx-auto my-8 grid grid-cols-3 gap-1 perspective-[800px]">
    {["0", "1", "0", "1", "1", "0", "0", "1"].map((digit, idx) => (
      <div
        key={idx}
        className={`text-orange-300 font-mono text-lg text-center drop-shadow-[0_0_6px_theme(colors.orange.400)] animate-matrix-fall animate-matrix-flicker opacity-0`}
        style={{ animationDelay: `${0.2 * idx}s` }}
      >
        {digit}
      </div>
    ))}
    <div className="absolute inset-0 bg-radial-pulse pointer-events-none" />
  </div>
);

export default function MediaGrid({ media }: MediaGridProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);

  // Grid loading states
  const [gridLoadingStates, setGridLoadingStates] = useState<boolean[]>(
    media.map(() => true)
  );

  // Slider loading states
  const [sliderLoadingStates, setSliderLoadingStates] = useState<boolean[]>(
    media.map(() => true)
  );

  const displayedMedia = useMemo(() => media?.slice(0, 4) || [], [media]);

  if (!media || media.length === 0) return null;

  const openSlider = (idx: number) => {
    setCurrentIndex(idx);
    setIsOpen(true);
  };

  const closeSlider = () => setIsOpen(false);

  const nextSlide = () => setCurrentIndex((prev) => (prev + 1) % media.length);
  const prevSlide = () =>
    setCurrentIndex((prev) => (prev - 1 + media.length) % media.length);

  return (
    <>
      {/* Media Grid */}
      <div
        className={`grid gap-2 rounded-md overflow-hidden ${
          media.length === 1 ? "grid-cols-1" : "grid-cols-2"
        }`}
      >
        {displayedMedia.map((file, idx) => (
          <div
            key={file.url}
            className="relative w-full aspect-square cursor-pointer"
            onClick={() => openSlider(idx)}
          >
            {file.type === "photo" && gridLoadingStates[idx] && <Spinner />}
            {file.type === "photo" ? (
              <Image
                src={file.url}
                alt="uploaded"
                fill
                className={`object-cover rounded-md transition-opacity duration-300 ${
                  gridLoadingStates[idx] ? "opacity-0" : "opacity-100"
                }`}
                sizes="(max-width: 768px) 100vw, 50vw"
                priority={idx === 0}
                quality={70}
                loading={idx === 0 ? "eager" : "lazy"}
                onLoadingComplete={() => {
                  setGridLoadingStates((prev) => {
                    const newStates = [...prev];
                    newStates[idx] = false;
                    return newStates;
                  });
                }}
              />
            ) : (
              <video
                src={file.url}
                className="w-full h-full object-cover rounded-md"
                preload="metadata"
              />
            )}

            {/* +N overlay */}
            {idx === 3 && media.length > 4 && (
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-md">
                <span className="text-white text-lg font-semibold">
                  +{media.length - 4}
                </span>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Slider Modal */}
      {isOpen && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50">
          {/* Close */}
          <button
            className="absolute top-4 right-4 text-white p-2 rounded-full bg-black/50 z-50 hover:bg-black/70 transition"
            onClick={closeSlider}
          >
            <X size={24} />
          </button>

          {/* Prev/Next */}
          {media.length > 1 && (
            <>
              <button
                className="absolute left-2 sm:left-4 text-white p-2 rounded-full bg-black/40 hover:bg-black/60 z-50 transition"
                onClick={prevSlide}
              >
                <ChevronLeft size={32} />
              </button>
              <button
                className="absolute right-2 sm:right-4 text-white p-2 rounded-full bg-black/40 hover:bg-black/60 z-50 transition"
                onClick={nextSlide}
              >
                <ChevronRight size={32} />
              </button>
            </>
          )}

          {/* Current Media */}
          <div className="max-w-[90%] max-h-[80%] flex items-center justify-center relative">
            {media[currentIndex].type === "photo" &&
              sliderLoadingStates[currentIndex] && <Spinner />}

            {media[currentIndex].type === "photo" ? (
              <Image
                src={media[currentIndex].url}
                alt="slider"
                width={800}
                height={800}
                className={`object-contain max-h-[80vh] rounded-md transition-opacity duration-300 ${
                  sliderLoadingStates[currentIndex]
                    ? "opacity-0"
                    : "opacity-100"
                }`}
                quality={80}
                loading="eager"
                onLoadingComplete={() => {
                  setSliderLoadingStates((prev) => {
                    const newStates = [...prev];
                    newStates[currentIndex] = false;
                    return newStates;
                  });
                }}
              />
            ) : (
              <video
                src={media[currentIndex].url}
                controls
                className="max-h-[80vh] rounded-md"
                preload="metadata"
              />
            )}
          </div>
        </div>
      )}
    </>
  );
}
