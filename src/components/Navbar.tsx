"use client";
import Shuffle from "../components/ShuffleText";
import Link from "next/link";
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import Image from "next/image";
import {
  House,
  Handshake,
  UsersRound,
  MessagesSquare,
  BellRing,
  Search,
  LogIn,
  X,
  UserRoundPlus,
} from "lucide-react";
import {
  ClerkLoaded,
  ClerkLoading,
  SignedIn,
  SignedOut,
  UserButton,
  useUser,
} from "@clerk/nextjs";
import MobileMenu from "./MobileMenu";
import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";

// Define the type for a user object
type User = {
  id: string;
  username: string;
  name?: string | null;
  avatar?: string | null;
};

// Santa Hat SVG Component - CLEAN FLAT VERSION
const SantaHat = ({ className = "w-10 h-10" }: { className?: string }) => (
  <div className={`pointer-events-none select-none z-20 ${className}`}>
    <svg
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="origin-[50%_80%] animate-[gentle-sway_3s_ease-in-out_infinite] drop-shadow-lg"
    >
      <defs>
        {/* Gradient for the hat body - deep red with dimension */}
        <linearGradient id="hatGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#EF4444" />
          <stop offset="50%" stopColor="#DC2626" />
          <stop offset="100%" stopColor="#991B1B" />
        </linearGradient>

        {/* Gradient for pom-pom - soft white glow */}
        <radialGradient id="pompomGradient" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="70%" stopColor="#F9FAFB" />
          <stop offset="100%" stopColor="#E5E7EB" />
        </radialGradient>

        {/* Gradient for fur trim - fluffy white effect */}
        <linearGradient id="furGradient" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="50%" stopColor="#F9FAFB" />
          <stop offset="100%" stopColor="#F3F4F6" />
        </linearGradient>

        {/* Shadow for depth */}
        <filter id="shadow">
          <feDropShadow dx="0" dy="2" stdDeviation="2" floodOpacity="0.3" />
        </filter>

        {/* Soft glow for pom-pom */}
        <filter id="glow">
          <feGaussianBlur stdDeviation="1.5" result="coloredBlur" />
          <feMerge>
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Main Hat Body - More detailed shape */}
      <path
        d="M20 75 Q 20 50, 30 35 Q 40 20, 55 15 L 80 28 Q 85 32, 88 38 Q 92 50, 90 75 Z"
        fill="url(#hatGradient)"
        stroke="#7F1D1D"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        filter="url(#shadow)"
      />

      {/* Inner shadow detail on hat */}
      <path
        d="M25 72 Q 28 55, 35 42 Q 42 30, 52 22"
        stroke="#B91C1C"
        strokeWidth="1.5"
        strokeOpacity="0.4"
        fill="none"
        strokeLinecap="round"
      />

      {/* Highlight on hat */}
      <path
        d="M35 40 Q 38 35, 45 32 Q 50 30, 55 28"
        stroke="#FCA5A5"
        strokeWidth="2"
        strokeOpacity="0.5"
        fill="none"
        strokeLinecap="round"
      />

      {/* Fur Trim - Fluffy bottom edge with multiple layers */}
      <ellipse
        cx="55"
        cy="75"
        rx="38"
        ry="8"
        fill="url(#furGradient)"
        stroke="#D1D5DB"
        strokeWidth="0.5"
      />

      {/* Fur trim texture - upper layer */}
      <ellipse cx="55" cy="73" rx="36" ry="6" fill="#FFFFFF" opacity="0.7" />

      {/* Fur trim bumps for texture */}
      <circle cx="25" cy="75" r="3.5" fill="#FFFFFF" opacity="0.9" />
      <circle cx="35" cy="77" r="3" fill="#F9FAFB" opacity="0.8" />
      <circle cx="45" cy="76" r="3.5" fill="#FFFFFF" opacity="0.9" />
      <circle cx="55" cy="78" r="3" fill="#F9FAFB" opacity="0.8" />
      <circle cx="65" cy="76" r="3.5" fill="#FFFFFF" opacity="0.9" />
      <circle cx="75" cy="77" r="3" fill="#F9FAFB" opacity="0.8" />
      <circle cx="85" cy="75" r="3.5" fill="#FFFFFF" opacity="0.9" />

      {/* Pom-pom base (smaller circle behind) */}
      <circle
        cx="82"
        cy="30"
        r="10"
        fill="url(#pompomGradient)"
        opacity="0.6"
        filter="url(#glow)"
      />

      {/* Main Pom-pom */}
      <circle
        cx="80"
        cy="28"
        r="9"
        fill="url(#pompomGradient)"
        stroke="#E5E7EB"
        strokeWidth="0.5"
        filter="url(#glow)"
      />

      {/* Pom-pom highlight */}
      <circle cx="77" cy="25" r="3.5" fill="#FFFFFF" opacity="0.8" />

      {/* Pom-pom texture dots */}
      <circle cx="82" cy="27" r="1" fill="#F3F4F6" opacity="0.6" />
      <circle cx="78" cy="30" r="0.8" fill="#F3F4F6" opacity="0.6" />
      <circle cx="81" cy="31" r="1" fill="#E5E7EB" opacity="0.5" />

      {/* Sparkle on pom-pom */}
      <g className="animate-[sparkle_2s_ease-in-out_infinite]">
        <circle cx="75" cy="23" r="1.5" fill="#FFFFFF" opacity="0.9" />
        <circle cx="75" cy="23" r="0.8" fill="#FEF3C7" />
      </g>

      {/* Small sparkle 2 */}
      <g
        className="animate-[sparkle_2s_ease-in-out_infinite]"
        style={{ animationDelay: "0.7s" }}
      >
        <circle cx="84" cy="33" r="1" fill="#FFFFFF" opacity="0.8" />
      </g>
    </svg>

    <style jsx>{`
      @keyframes gentle-sway {
        0%,
        100% {
          transform: rotate(-15deg);
        }
        50% {
          transform: rotate(-10deg) translateY(-3px);
        }
      }

      @keyframes sparkle {
        0%,
        100% {
          opacity: 1;
          transform: scale(1);
        }
        50% {
          opacity: 0.4;
          transform: scale(0.8);
        }
      }
    `}</style>
  </div>
);


// Define the props for the Navbar component
function Navbar({ users }: { users: User[] }) {
  const { user, isLoaded } = useUser();
  const [query, setQuery] = useState("");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const userDataRef = useRef<string>("");
  const timeoutRef = useRef<NodeJS.Timeout>();

  // Memoize current user data to prevent unnecessary recalculations
  const currentUserData = useMemo(() => {
    if (!isLoaded || !user) return "";

    return JSON.stringify({
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
      imageUrl: user.imageUrl,
      updatedAt: user.updatedAt,
    });
  }, [
    user?.username,
    user?.firstName,
    user?.lastName,
    user?.imageUrl,
    user?.updatedAt,
    isLoaded,
  ]);
  const { isSignedIn } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // When the user signs out, redirect them automatically
    if (isLoaded && !isSignedIn) {
      router.push("/sign-up");
    }
  }, [isSignedIn, isLoaded, router]);

  // Debounced search filtering to improve performance
  const filteredUsers = useMemo(() => {
    if (query.trim() === "") {
      return users.slice(0, 10);
    }

    const lowerCaseQuery = query.toLowerCase();
    return users
      .filter(
        (user) =>
          user.username?.toLowerCase().includes(lowerCaseQuery) ||
          user.name?.toLowerCase().includes(lowerCaseQuery)
      )
      .slice(0, 20);
  }, [query, users]);

  // Optimized user profile change detection
  useEffect(() => {
    if (!currentUserData) return;

    if (userDataRef.current && userDataRef.current !== currentUserData) {
      console.log("👤 User profile updated, refreshing page...");

      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = setTimeout(() => {
        window.location.reload();
      }, 1000);
    }

    userDataRef.current = currentUserData;
  }, [currentUserData]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  // Memoized toggle function to prevent unnecessary re-renders
  const toggleSearch = useCallback(() => {
    setIsSearchOpen((prev) => !prev);
  }, []);

  // Debounced query handler
  const handleQueryChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setQuery(e.target.value);
    },
    []
  );

  // Focus search input when overlay opens
  useEffect(() => {
    if (isSearchOpen && searchInputRef.current) {
      const timer = setTimeout(() => {
        searchInputRef.current?.focus();
      }, 100);

      return () => clearTimeout(timer);
    }
  }, [isSearchOpen]);

  return (
    <div className="h-24 flex justify-between items-center px-4 md:px-12 bg-rose-800 text-rose-100 dark:bg-gray-800 dark:text-white border-b border-rose-700 dark:border-gray-700 transition-colors duration-300">
      {/* Logo with Santa Hat */}
      <div className="block md:hidden lg:block w-[30%] mt-2">
        <Link
          href="/"
          className="font-bold uppercase text-orange-300 dark:text-white tracking-wide relative inline-block group"
        >
          <div className="relative inline-block">
            {/* Same positioning as requested */}
            <SantaHat className="absolute -top-4 -left-3 w-8 h-8" />

            <Shuffle
              text="Goga_Network"
              className="text-lg md:text-lg lg:text-xl font-bold"
              shuffleDirection="right"
              duration={0.35}
              animationMode="evenodd"
              shuffleTimes={4}
              ease="power3.out"
              stagger={0.03}
              threshold={0.1}
              triggerOnce={true}
              tag="h6"
              triggerOnHover={true}
              respectReducedMotion={true}
            />
          </div>

          <div className="mt-1 flex items-center justify-start gap-2 pl-0.5">
            <span className="text-xs animate-pulse filter drop-shadow-md">
              🎄
            </span>
            <span className="text-[11px] font-semibold uppercase tracking-[0.15em] bg-gradient-to-r from-rose-200 via-orange-200 to-rose-200 bg-clip-text text-transparent drop-shadow-sm dark:from-gray-300 dark:to-gray-500">
              Happy Holidays
            </span>
            <span className="text-xs animate-pulse delay-75 filter drop-shadow-md">
              ❄️
            </span>
          </div>
        </Link>
      </div>

      {/* Navigation Links */}
      <div className="hidden md:flex w-[40%] justify-center text-sm justify-between">
        <div className="flex gap-8 items-center">
          {/* Home */}
          <Link
            href="/"
            className="flex items-center gap-2 hover:text-rose-400 dark:text-white dark:hover:text-gray-300 transition-all duration-300 hover:-translate-y-[1px]"
          >
            <House className="w-5 h-5 text-orange-300 dark:text-gray-400" />
            <span>Home</span>
          </Link>

          {/* Friends */}
          <Link
            href="/friends"
            className="flex items-center gap-2 hover:text-rose-400 dark:text-white dark:hover:text-gray-300 transition-all duration-300 hover:-translate-y-[1px]"
          >
            <Handshake className="w-5 h-5 text-orange-300 dark:text-gray-400" />
            <span>Friends</span>
          </Link>

          {/* Requests */}
          <Link
            href="/requests"
            className="flex items-center gap-2 hover:text-rose-400 dark:text-white dark:hover:text-gray-300 transition-all duration-300 hover:-translate-y-[1px]"
          >
            <UserRoundPlus className="w-5 h-5 text-orange-300 dark:text-gray-400" />
            <span>Requests</span>
          </Link>
        </div>

        {/* Search (Desktop) */}
        {user && isLoaded && (
          <div
            onClick={toggleSearch}
            className="hidden xl:flex ml-5 p-2 bg-rose-700 dark:bg-gray-900 rounded-xl items-center cursor-pointer transition-all duration-300 hover:bg-rose-600 dark:hover:bg-gray-700/50"
          >
            <input
              type="text"
              className="bg-transparent outline-none placeholder-rose-300 dark:placeholder-gray-400 text-sm cursor-pointer"
              placeholder="Search users..."
              readOnly
            />
            <Search className="text-orange-300 dark:text-gray-400" />
          </div>
        )}
      </div>

      {/* Right Section (Auth + Mobile Search) */}
      <div className="w-[30%] flex justify-end items-center gap-4">
        {user && isLoaded && (
          <button
            onClick={toggleSearch}
            className="xl:hidden text-orange-300 dark:text-gray-400 hover:text-rose-400 dark:hover:text-white transition-all duration-300"
          >
            <Search className="w-6 h-6" />
          </button>
        )}

        {/* Clerk Auth */}
        <ClerkLoading>
          <div className="flex items-center justify-center h-16">
            <div className="relative w-8 h-8">
              <div className="w-8 h-8 rounded-full border-t-4 border-b-4 border-rose-600 dark:border-gray-700"></div>
              <div className="absolute top-0 left-0 w-8 h-8 rounded-full border-t-4 border-b-4 border-orange-300 dark:border-white animate-spin"></div>
            </div>
          </div>
        </ClerkLoading>

        <ClerkLoaded>
          <SignedIn>
            <div className="flex items-center gap-3">
              <Link href="/chat">
                <MessagesSquare className="hidden sm:inline-flex text-orange-300 dark:text-gray-400 cursor-pointer hover:text-rose-400 dark:hover:text-white transition-all duration-300" />
              </Link>
              <UserButton appearance={{ elements: { avatarBox: "w-8 h-8" } }} />
            </div>
          </SignedIn>

          <SignedOut>
            <Link
              href="/sign-in"
              className="flex items-center gap-2 text-sm text-rose-100 dark:text-white hover:text-rose-400 dark:hover:text-gray-300 transition-all duration-300 hover:-translate-y-[1px]"
            >
              <LogIn className="w-5 h-5 text-orange-300 dark:text-gray-400" />
              <span>Login / Register</span>
            </Link>
          </SignedOut>
        </ClerkLoaded>

        <MobileMenu />
      </div>

      {/* Full-screen Search Overlay */}
      <div
        className={`fixed inset-0 z-50 flex flex-col items-center justify-start bg-rose-900 bg-opacity-95 dark:bg-gray-900 dark:bg-opacity-95 backdrop-blur-sm pt-20 transition-all duration-500
        ${
          isSearchOpen
            ? "opacity-100 scale-100"
            : "opacity-0 scale-95 pointer-events-none"
        }`}
      >
        <div className="w-full max-w-lg p-4 rounded-lg shadow-xl">
          <div className="flex items-center gap-4 bg-rose-700 dark:bg-gray-800 rounded-xl p-2">
            <Search className="text-orange-300 dark:text-gray-400" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search users..."
              value={query}
              onChange={handleQueryChange}
              className="flex-grow bg-transparent text-white placeholder-rose-200 dark:placeholder-gray-400 outline-none"
            />
            <button onClick={toggleSearch}>
              <X className="text-rose-100 dark:text-gray-400 hover:text-orange-300 dark:hover:text-white transition-colors" />
            </button>
          </div>
          <div className="mt-4 text-center">
            {query.trim() === "" ? (
              <p className="text-rose-200 dark:text-gray-400 text-sm">
                Start typing to search for users.
              </p>
            ) : (
              <div className="mt-4 max-h-[70vh] overflow-y-auto">
                {filteredUsers.length > 0 ? (
                  filteredUsers.map((user) => (
                    <Link
                      key={user.id}
                      href={`/profile/${user.username}`}
                      onClick={toggleSearch}
                      className="flex items-center gap-4 p-3 mb-2 rounded-lg bg-rose-800 hover:bg-rose-700 dark:bg-gray-800 dark:hover:bg-gray-700/50 transition-colors duration-200 border border-rose-700 dark:border-gray-700"
                    >
                      <Image
                        src={user.avatar || "/noAvatar.png"}
                        alt={user.username || "User"}
                        width={40}
                        height={40}
                        className="rounded-full object-cover w-10 h-10"
                      />
                      <div className="flex flex-col items-start">
                        <span className="font-semibold text-rose-100 dark:text-white">
                          {user.name || user.username}
                        </span>
                        {user.name && (
                          <span className="text-xs text-rose-300 dark:text-gray-400">
                            @{user.username}
                          </span>
                        )}
                      </div>
                    </Link>
                  ))
                ) : (
                  <p className="text-rose-200 dark:text-gray-400 text-sm">
                    No users found.
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default Navbar;
