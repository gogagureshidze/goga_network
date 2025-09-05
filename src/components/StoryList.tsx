"use client";

import { addStory } from "@/actions/addStory";
import { Story, User } from "@/generated/prisma";
import { CldUploadWidget } from "next-cloudinary";
import Image from "next/image";
import {
  useOptimistic,
  useState,
  useTransition,
  useEffect,
  useRef,
} from "react";
import { useUser } from "@clerk/nextjs";

type StoryWithUser = Story & { user: User };

export default function StoryList({
  stories,
  userId,
}: {
  stories: StoryWithUser[];
  userId: string;
}) {
  const [img, setImg] = useState<any>();
  const [isPending, startTransition] = useTransition();
  const { user, isLoaded } = useUser();

  const [optimisticStories, addOptimisticStory] = useOptimistic(
    stories,
    (state, newStory: StoryWithUser) => [newStory, ...state]
  );

  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [progress, setProgress] = useState(0);
  const timerRef = useRef<number | null>(null);

  const handleAddStory = async () => {
    if (!img?.secure_url) return;

    const newOptimisticStory: StoryWithUser = {
      id: Math.random(),
      img: img.secure_url,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      userId,
      user: {
        id: userId,
        username: user?.username || "Sending...",
        avatar: user?.imageUrl || "/noAvatar.png",
        cover: user?.imageUrl || "/noCover.png",
        description: "",
        name: user?.firstName || "",
        surname: user?.lastName || "",
        city: "",
        work: "",
        school: "",
        website: "",
        createdAt: new Date(),
      },
    };

    addOptimisticStory(newOptimisticStory);
    setImg(null);

    startTransition(async () => {
      try {
        await addStory(img.secure_url);
      } catch (err) {
        console.error("Failed to add story:", err);
      }
    });
  };

  const goNextStory = () => {
    if (activeIndex === null) return;
    if (activeIndex < optimisticStories.length - 1) {
      setActiveIndex(activeIndex + 1);
    } else {
      setActiveIndex(null); // close when last story finished
    }
  };

  const goPrevStory = () => {
    if (activeIndex === null) return;
    if (activeIndex > 0) setActiveIndex(activeIndex - 1);
  };

  // Main timer logic to fix the bug
  useEffect(() => {
    if (activeIndex !== null) {
      setProgress(0);
      const duration = 10000;
      const start = Date.now();

      const newTimer = window.setInterval(() => {
        const elapsed = Date.now() - start;
        setProgress(Math.min((elapsed / duration) * 100, 100));

        if (elapsed >= duration) {
          goNextStory();
        }
      }, 100);

      timerRef.current = newTimer;

      return () => {
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
      };
    }
  }, [activeIndex, optimisticStories]);

  if (!isLoaded || !user) return null;

  return (
    <>
      {/* Add Story Button */}
      {!img && (
        <CldUploadWidget
          uploadPreset="social"
          onSuccess={(result, { widget }) => {
            setImg(result.info);
            widget.close();
          }}
        >
          {({ open }) => (
            <div className="flex flex-col items-center gap-2 cursor-pointer relative">
              <div
                className="p-[3px] rounded-full bg-gradient-to-tr from-orange-300 via-pink-200 to-red-800"
                onClick={() => open()}
              >
                <Image
                  src={user.imageUrl || "/noAvatar.png"}
                  alt="Add Story"
                  width={80}
                  height={80}
                  className="w-20 h-20 rounded-full object-cover bg-white"
                />
              </div>
              <span className="font-medium text-xs">Add a Story</span>
              <div className="absolute -bottom-1 -right-1 flex items-center justify-center bg-white rounded-full p-1">
                <div className="bg-blue-500 rounded-full w-5 h-5 flex items-center justify-center">
                  <span className="text-white text-xl -mt-1">+</span>
                </div>
              </div>
            </div>
          )}
        </CldUploadWidget>
      )}

      {/* Story Preview Modal */}
      {img && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-80 p-4"
          onClick={() => setImg(null)}
        >
          <div
            className="flex flex-col items-center justify-center gap-4 bg-white rounded-lg p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <Image
              src={img.secure_url}
              alt="Story Preview"
              width={300}
              height={300}
              className="w-full max-w-sm h-auto max-h-96 object-contain rounded-lg shadow-lg"
            />
            <div className="flex gap-4 w-full">
              <button
                onClick={() => setImg(null)}
                className="flex-1 text-sm bg-gray-200 p-2 rounded-md text-gray-800 font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleAddStory}
                disabled={isPending}
                className="flex-1 text-sm bg-blue-500 p-2 rounded-md text-white font-semibold disabled:bg-opacity-50 transition-all duration-200"
              >
                {isPending ? "Sending..." : "Send"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Instagram-like Story Viewer */}
      {activeIndex !== null && (
        <div
          className="fixed inset-0 z-50 flex flex-col bg-black bg-opacity-95"
          onClick={() => setActiveIndex(null)}
        >
          <button
            onClick={(e) => {
              e.stopPropagation();
              setActiveIndex(null);
            }}
            className="absolute top-4 right-4 text-white text-2xl font-bold"
          >
            ✕
          </button>

          {/* Progress Bar */}
          <div className="flex gap-1 p-2">
            {optimisticStories.map((_, idx) => (
              <div key={idx} className="flex-1 h-1 bg-gray-600 rounded">
                <div
                  className="h-1 bg-green-500 transition-all"
                  style={{
                    width:
                      idx === activeIndex
                        ? `${progress}%`
                        : idx < activeIndex
                        ? "100%"
                        : "0%",
                  }}
                />
              </div>
            ))}
          </div>

          {/* Story Image */}
          <div
            className="flex-1 flex items-center justify-center"
            onClick={(e) => e.stopPropagation()}
          >
            <Image
              src={optimisticStories[activeIndex].img}
              alt="Story"
              width={600}
              height={600}
              className="max-h-full max-w-full object-contain"
            />
          </div>

          {/* Navigation: Click left/right to go prev/next */}
          <div
            className="absolute inset-0 flex justify-between items-center"
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="flex-1 h-full cursor-pointer"
              onClick={goPrevStory}
            />
            <div
              className="flex-1 h-full cursor-pointer"
              onClick={goNextStory}
            />
          </div>
        </div>
      )}

      {/* Story Bubbles */}
      <div className="flex gap-4 overflow-x-auto scrollbar-hide py-2">
        {optimisticStories.map((story, idx) => (
          <div
            key={story.id}
            className="flex flex-col items-center gap-1 cursor-pointer"
            onClick={() => setActiveIndex(idx)}
          >
            <div className="p-[2px] bg-gradient-to-tr from-orange-300 via-pink-200 to-red-900 rounded-full">
              <Image
                src={story.user.avatar || "/noAvatar.png"}
                alt="Story"
                width={70}
                height={70}
                className="w-16 h-16 rounded-full object-cover bg-white"
              />
            </div>
            <span className="font-medium text-xs truncate w-16 text-center">
              {story.user.name || story.user.username}
            </span>
          </div>
        ))}
      </div>
    </>
  );
}
