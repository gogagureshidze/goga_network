// components/MediaGallery.tsx
"use client";

import { useState, useRef, useEffect } from "react"; // ADDED useRef and useEffect
import Image from "next/image";
import { X, ChevronLeft, ChevronRight, Download } from "lucide-react";

interface Media {
  id: number;
  url: string;
  type: string;
}

interface MediaGalleryProps {
  allMedia: Media[];
  userName: string;
}

export default function MediaGallery({
  allMedia = [],
  userName,
}: MediaGalleryProps) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const lightboxRef = useRef<HTMLDivElement>(null); // REF for focusing lightbox

  // FOCUS the lightbox when it opens (Fixes keyboard navigation bug)
  useEffect(() => {
    if (selectedIndex !== null && lightboxRef.current) {
      lightboxRef.current.focus();
    }
  }, [selectedIndex]);

  const openLightbox = (index: number) => {
    setSelectedIndex(index);
  };

  const closeLightbox = () => {
    setSelectedIndex(null);
  };

  const goNext = () => {
    if (selectedIndex !== null && selectedIndex < allMedia.length - 1) {
      setSelectedIndex(selectedIndex + 1);
    }
  };

  const goPrev = () => {
    if (selectedIndex !== null && selectedIndex > 0) {
      setSelectedIndex(selectedIndex - 1);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (selectedIndex !== null) {
      if (e.key === "ArrowRight") {
        e.preventDefault();
        goNext();
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        goPrev();
      }
      if (e.key === "Escape") closeLightbox();
    }
  };

  const handleDownload = async (e: React.MouseEvent) => {
    e.preventDefault(); // Prevent default link behavior
    e.stopPropagation(); // Stop click from closing lightbox

    if (selectedIndex === null) return;

    const mediaItem = allMedia[selectedIndex];
    const url = mediaItem.url;

    // Create a safe, descriptive filename
    const urlParts = url.split("/");
    const filenameWithParams = urlParts[urlParts.length - 1].split("?")[0];
    const filename = `${userName}_${mediaItem.id}_${filenameWithParams}`;

    try {
      // Fetch the file as a blob (requires the media source to allow CORS)
      const response = await fetch(url);
      const blob = await response.blob();

      // Create a temporary object URL for the blob
      const blobUrl = window.URL.createObjectURL(blob);

      // Create and click a temporary <a> element to trigger download
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = filename;

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Clean up
      window.URL.revokeObjectURL(blobUrl);
    } catch (error) {
      console.error("Download failed, falling back to direct link:", error);
      // Fallback: If fetch fails, open the URL directly (browser might still download)
      window.open(url, "_blank");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-rose-50 via-orange-50 to-rose-100 py-12 ">
      <div className="max-w-7xl mx-auto px-6 flex align-center justfy-center flex-col gap-8 text-center">
        {/* Header */}
        <div className="mb-10">
          <h1 className="text-5xl font-black bg-gradient-to-r from-rose-600 via-orange-500 to-rose-700 bg-clip-text text-transparent mb-2">
            Your Media Gallery
          </h1>
          <p className="text-lg text-gray-700">
            Welcome back,{" "}
            <span className="font-bold text-orange-600">{userName}</span>!
            <span className="text-gray-600 ml-2">
              ({allMedia.length} items)
            </span>
          </p>
        </div>

        {allMedia.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-24 h-24 bg-gradient-to-br from-orange-400 to-rose-500 rounded-full flex items-center justify-center mb-6">
              <span className="text-4xl">📸</span>
            </div>
            <p className="text-xl text-gray-600 font-medium">
              No media found yet
            </p>
            <p className="text-sm text-gray-500 mt-2">
              Start sharing photos and videos!
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {allMedia.map((file, index) => (
              <div
                key={file.id}
                onClick={() => openLightbox(index)}
                className="group relative overflow-hidden rounded-2xl shadow-lg bg-white cursor-pointer transform transition-all duration-300 hover:scale-105 hover:shadow-2xl hover:shadow-orange-300/50"
              >
                {file.type === "photo" ? (
                  <div className="relative w-full aspect-square">
                    <Image
                      src={file.url}
                      alt="media"
                      fill
                      className="object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  </div>
                ) : (
                  <div className="relative w-full aspect-square">
                    <video
                      key={file.url}
                      src={file.url}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                      <div className="w-12 h-12 bg-white/90 rounded-full flex items-center justify-center">
                        <span className="text-2xl">▶️</span>
                      </div>
                    </div>
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Lightbox */}
        {selectedIndex !== null && (
          <div
            className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center"
            onClick={closeLightbox}
            onKeyDown={handleKeyDown}
            tabIndex={0}
            ref={lightboxRef} // ATTACH REF HERE
          >
            {/* Close button */}
            <button
              onClick={closeLightbox}
              className="absolute top-4 right-4 z-50 text-white bg-white/10 hover:bg-white/20 rounded-full p-3 transition-all duration-300 hover:scale-110 backdrop-blur-sm"
            >
              <X className="w-6 h-6" />
            </button>

            {/* Counter */}
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 bg-white/10 backdrop-blur-sm px-6 py-2 rounded-full">
              <span className="text-white font-semibold">
                {selectedIndex + 1} / {allMedia.length}
              </span>
            </div>

            {/* Download button - MODIFIED to use handleDownload */}
            <a
              href={allMedia[selectedIndex].url}
              onClick={handleDownload} // USE NEW JS FUNCTION
              download
              rel="noopener noreferrer"
              className="absolute top-4 right-20 z-50 text-white bg-white/10 hover:bg-white/20 rounded-full p-3 transition-all duration-300 hover:scale-110 backdrop-blur-sm"
            >
              <Download className="w-6 h-6" />
            </a>

            {/* Previous button */}
            {selectedIndex > 0 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  goPrev();
                }}
                className="absolute left-4 z-50 text-white bg-white/10 hover:bg-white/20 rounded-full p-4 transition-all duration-300 hover:scale-110 backdrop-blur-sm"
              >
                <ChevronLeft className="w-8 h-8" />
              </button>
            )}

            {/* Next button */}
            {selectedIndex < allMedia.length - 1 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  goNext();
                }}
                className="absolute right-4 z-50 text-white bg-white/10 hover:bg-white/20 rounded-full p-4 transition-all duration-300 hover:scale-110 backdrop-blur-sm"
              >
                <ChevronRight className="w-8 h-8" />
              </button>
            )}

            {/* Media content */}
            <div
              className="relative max-w-[90vw] max-h-[90vh]"
              onClick={(e) => e.stopPropagation()}
            >
              {allMedia[selectedIndex].type === "photo" ? (
                <Image
                  src={allMedia[selectedIndex].url}
                  alt="media"
                  width={1200}
                  height={1200}
                  className="max-w-full max-h-[90vh] object-contain rounded-lg"
                />
              ) : (
                <video
                  src={allMedia[selectedIndex].url}
                  controls
                  autoPlay
                  className="max-w-full max-h-[90vh] object-contain rounded-lg"
                />
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
