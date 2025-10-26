import Image from "next/image";
import React from "react";
import { Ellipsis, CodeXml } from "lucide-react";

const Ad = ({ size }: { size: "sm" | "md" | "lg" }) => {
  return (
    <div className="p-4 bg-white rounded-lg shadow-md text-sm dark:bg-gray-800 transition-colors duration-300">
      <div className="flex items-center justify-between text-gray-500 dark:text-gray-400 font-medium">
        <span>Sponsored Ads</span>
        <Ellipsis className="cursor-pointer" />
      </div>

      <div
        className={`flex flex-col mt-4 ${size === "sm" ? "gap-2" : "gap-4"}`}
      >
        <div
          className={`relative w-full ${
            size === "sm" ? "h-24" : size === "md" ? "h-36" : "h-48"
          }`}
        >
          <Image
            alt="sponsor"
            className="rounded-lg object-cover cursor-pointer"
            fill
            src="/sponsor.png"
          ></Image>
        </div>
        <div className="flex items-center gap-4 cursor-pointer">
          <CodeXml className="text-orange-600 dark:text-gray-400 h-10 w-10 transition-colors duration-300" />
          <span className="text-gray-900 dark:text-white font-medium">
            Tech Interview AI voice assistant (SOON)!
          </span>
        </div>
        <p
          className={`text-gray-600 dark:text-gray-400 ${
            size === "sm" ? "text-xs" : "text-sm"
          }`}
        >
          {size === "sm"
            ? "Get ready for your next tech interview with our AI voice assistant.)"
            : size === "md"
            ? "Prepare for your tech interview with our AI assistant. Practice coding and get instant feedback."
            : "Crush your next tech interview with our AI voice assistant. Practice coding questions, get graded feedback, and gain the confidence to succeed."}
        </p>
        <button className="bg-orange-300 hover:bg-rose-300 text-white dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-gray-200 font-semibold text-sm px-4 py-2 rounded-lg shadow-sm transition-all duration-200">
          Learn More...
        </button>
      </div>
    </div>
  );
};

export default Ad;
