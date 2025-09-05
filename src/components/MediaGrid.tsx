"use client";

import { useState } from "react";
import Image from "next/image";
import { X, ChevronLeft, ChevronRight } from "lucide-react";

interface MediaGridProps {
  media: { type: "photo" | "video"; url: string }[];
}

export default function MediaGrid({ media }: MediaGridProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);

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
        {media.slice(0, 4).map((file, idx) => (
          <div
            key={idx}
            className="relative w-full aspect-square cursor-pointer"
            onClick={() => openSlider(idx)}
          >
            {file.type === "photo" ? (
              <Image
                src={file.url}
                alt="uploaded"
                fill
                className="object-cover rounded-md"
              />
            ) : (
              <video
                src={file.url}
                className="w-full h-full object-cover rounded-md"
              />
            )}

            {/* Show +N overlay if more than 4 */}
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
          {/* Close Button */}
          <button
            className="absolute top-4 right-4 text-white p-2 rounded-full bg-black/50"
            onClick={closeSlider}
          >
            <X size={24} />
          </button>

          {/* Prev Button */}
          {media.length > 1 && (
            <button
              className="absolute left-4 text-white p-2 rounded-full bg-black/50"
              onClick={prevSlide}
            >
              <ChevronLeft size={32} />
            </button>
          )}

          {/* Current Media */}
          <div className="max-w-[90%] max-h-[80%] flex items-center justify-center">
            {media[currentIndex].type === "photo" ? (
              <Image
                src={media[currentIndex].url}
                alt="slider"
                width={800}
                height={800}
                className="object-contain max-h-[80vh] rounded-md"
              />
            ) : (
              <video
                src={media[currentIndex].url}
                controls
                className="max-h-[80vh] rounded-md"
              />
            )}
          </div>

          {/* Next Button */}
          {media.length > 1 && (
            <button
              className="absolute right-4 text-white p-2 rounded-full bg-black/50"
              onClick={nextSlide}
            >
              <ChevronRight size={32} />
            </button>
          )}
        </div>
      )}
    </>
  );
}
