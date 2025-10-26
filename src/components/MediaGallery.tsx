"use client";

import { useState, useRef, useEffect } from "react";
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
  id: string;
  currentUserId?: string | null;
}

export default function MediaGallery({
  allMedia = [],
  userName,
  id,
  currentUserId,
}: MediaGalleryProps) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [loadingImages, setLoadingImages] = useState<Set<number>>(
    new Set(allMedia.filter((m) => m.type === "photo").map((m) => m.id))
  );
  const [loadingVideos, setLoadingVideos] = useState<Set<number>>(
    new Set(allMedia.filter((m) => m.type === "video").map((m) => m.id))
  );

  const lightboxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (selectedIndex !== null && lightboxRef.current) {
      lightboxRef.current.focus();
    }
  }, [selectedIndex]);

  const handleImageLoad = (id: number) => {
    setLoadingImages((prev) => {
      const newSet = new Set(prev);
      newSet.delete(id);
      return newSet;
    });
  };

  const handleVideoLoad = (id: number) => {
    setLoadingVideos((prev) => {
      const newSet = new Set(prev);
      newSet.delete(id);
      return newSet;
    });
  };

  const openLightbox = (index: number) => setSelectedIndex(index);
  const closeLightbox = () => setSelectedIndex(null);
  const goNext = () =>
    setSelectedIndex((i) =>
      i !== null && i < allMedia.length - 1 ? i + 1 : i
    );
  const goPrev = () =>
    setSelectedIndex((i) => (i !== null && i > 0 ? i - 1 : i));

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (selectedIndex !== null) {
      if (e.key === "ArrowRight") goNext();
      if (e.key === "ArrowLeft") goPrev();
      if (e.key === "Escape") closeLightbox();
    }
  };

  const handleDownload = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (selectedIndex === null) return;
    const mediaItem = allMedia[selectedIndex];
    const url = mediaItem.url;

    const urlParts = url.split("/");
    const filenameWithParams = urlParts[urlParts.length - 1].split("?")[0];
    const filename = `${userName}_${mediaItem.id}_${filenameWithParams}`;

    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (error) {
      console.error("Download failed, opening directly:", error);
      window.open(url, "_blank");
    }
  };

  const isOwnGallery = currentUserId === id;

  return (
    <div className="min-h-screen bg-gradient-to-br from-rose-50 via-orange-50 to-rose-100 dark:bg-none dark:bg-gray-900 py-12 transition-colors duration-300">
      <div className="max-w-7xl mx-auto px-6 flex flex-col gap-8 text-center">
        {/* Header */}
        <div className="mb-10">
          <h1 className="text-5xl font-black bg-gradient-to-r from-rose-600 via-orange-500 to-rose-700 bg-clip-text text-transparent dark:bg-none dark:text-white mb-2">
            {isOwnGallery
              ? "Your Media Gallery"
              : `${userName}'s Media Gallery`}
          </h1>

          <p className="text-lg text-gray-700 dark:text-gray-400">
            {isOwnGallery ? (
              <>
                Welcome back,{" "}
                <span className="font-bold text-orange-600 dark:text-white">
                  {userName}
                </span>
                !
              </>
            ) : (
              <>
                This is{" "}
                <span className="font-bold text-orange-600 dark:text-white">
                  {userName}
                </span>
                {"'s"} library of photos and videos.
              </>
            )}
            <span className="text-gray-600 dark:text-gray-500 ml-2">
              ({allMedia.length} items)
            </span>
          </p>
        </div>

        {/* Empty gallery */}
        {allMedia.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-24 h-24 bg-gradient-to-br from-orange-400 to-rose-500 dark:bg-none dark:bg-gray-700 rounded-full flex items-center justify-center mb-6">
              <span className="text-4xl">📸</span>
            </div>
            <p className="text-xl text-gray-600 dark:text-gray-400 font-medium">
              No media found yet
            </p>
            {isOwnGallery && (
              <p className="text-sm text-gray-500 mt-2">
                Start sharing photos and videos!
              </p>
            )}
          </div>
        ) : (
          // Media grid
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {allMedia.map((file, index) => (
              <div
                key={file.id}
                onClick={() => openLightbox(index)}
                className="group relative overflow-hidden rounded-2xl shadow-lg bg-white dark:bg-gray-800 cursor-pointer transform transition-all duration-300 hover:scale-105 hover:shadow-2xl hover:shadow-orange-300/50 dark:hover:shadow-gray-700/50"
              >
                {file.type === "photo" ? (
                  <div className="relative w-full aspect-square">
                    {loadingImages.has(file.id) && (
                      <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-orange-100 to-rose-100 dark:bg-none dark:bg-gray-700 z-10">
                        <div className="w-8 h-8 border-4 border-orange-500 dark:border-gray-500 border-t-transparent rounded-full animate-spin" />
                      </div>
                    )}
                    <Image
                      src={file.url}
                      alt="media"
                      fill
                      className="object-cover transition-opacity duration-300"
                      onLoad={() => handleImageLoad(file.id)}
                    />
                  </div>
                ) : (
                  <div className="relative w-full aspect-square">
                    {loadingVideos.has(file.id) && (
                      <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-orange-100 to-rose-100 dark:bg-none dark:bg-gray-700 z-10">
                        <div className="w-8 h-8 border-4 border-rose-500 dark:border-gray-500 border-t-transparent rounded-full animate-spin" />
                      </div>
                    )}
                    <video
                      key={file.url}
                      src={file.url}
                      onLoadedData={() => handleVideoLoad(file.id)}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                      <div className="w-12 h-12 bg-white/90 dark:bg-gray-900/90 rounded-full flex items-center justify-center">
                        <span className="text-2xl">▶️</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Lightbox - This UI is already dark and works for both themes */}
        {selectedIndex !== null && (
          <div
            className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center"
            onClick={closeLightbox}
            onKeyDown={handleKeyDown}
            tabIndex={0}
            ref={lightboxRef}
          >
            {/* Close */}
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

            {/* Download */}
            <a
              href={allMedia[selectedIndex].url}
              onClick={handleDownload}
              download
              rel="noopener noreferrer"
              className="absolute top-4 right-20 z-50 text-white bg-white/10 hover:bg-white/20 rounded-full p-3 transition-all duration-300 hover:scale-110 backdrop-blur-sm"
            >
              <Download className="w-6 h-6" />
            </a>

            {/* Prev / Next */}
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

            {/* Main Media */}
            <div
              className="relative max-w-[90vw] max-h-[90vh]"
              onClick={(e) => e.stopPropagation()}
            >
              {allMedia[selectedIndex].type === "photo" ? (
                <div className="relative">
                  {loadingImages.has(allMedia[selectedIndex].id) && (
                    <div className="absolute inset-0 flex items-center justify-center z-10">
                      <div className="w-12 h-12 border-4 border-white border-t-transparent rounded-full animate-spin" />
                    </div>
                  )}
                  <Image
                    src={allMedia[selectedIndex].url}
                    alt="media"
                    width={1200}
                    height={1200}
                    className="max-w-full max-h-[90vh] object-contain rounded-lg"
                    onLoad={() => handleImageLoad(allMedia[selectedIndex].id)}
                  />
                </div>
              ) : (
                <video
                  src={allMedia[selectedIndex].url}
                  controls
                  autoPlay
                  onLoadedData={() =>
                    handleVideoLoad(allMedia[selectedIndex].id)
                  }
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
