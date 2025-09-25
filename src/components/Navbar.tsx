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

// Define the type for a user object
type User = {
  id: string;
  username: string;
  name?: string | null;
  avatar?: string | null;
};

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

  // Debounced search filtering to improve performance
  const filteredUsers = useMemo(() => {
    if (query.trim() === "") {
      return users.slice(0, 10); // Limit initial results
    }

    const lowerCaseQuery = query.toLowerCase();
    return users
      .filter(
        (user) =>
          user.username?.toLowerCase().includes(lowerCaseQuery) ||
          user.name?.toLowerCase().includes(lowerCaseQuery)
      )
      .slice(0, 20); // Limit search results
  }, [query, users]);

  // Optimized user profile change detection
  useEffect(() => {
    if (!currentUserData) return;

    // Only trigger refresh if this isn't the initial load and data actually changed
    if (userDataRef.current && userDataRef.current !== currentUserData) {
      console.log("👤 User profile updated, refreshing page...");

      // Clear any existing timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      // Debounce the refresh to prevent rapid reloads
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
    <div className="h-24 flex justify-between items-center px-4 md:px-12 bg-rose-800 text-rose-100">
      {/* Logo */}
      <div className="block md:hidden lg:block w-[30%] mt-2">
        <Link
          href="/"
          className="font-bold uppercase  text-orange-300 tracking-wide"
        >
          <Shuffle
            text="Goga_Network"
            className="text-lg md:text-lg lg:text-xl font-bold"
            shuffleDirection="right"
            duration={0.35}
            animationMode="evenodd"
            shuffleTimes={1}
            ease="power3.out"
            stagger={0.03}
            threshold={0.1}
            triggerOnce={true}
            tag="h6"
            triggerOnHover={true}
            respectReducedMotion={true}
          />
        </Link>
      </div>

      {/* Navigation Links */}
      <div className="hidden md:flex w-[40%] justify-center text-sm justify-between">
        <div className="flex gap-8 items-center">
          {/* Home */}
          <Link
            href="/"
            className="flex items-center gap-2 hover:text-rose-400 transition-all duration-300 hover:-translate-y-[1px]"
          >
            <House className="w-5 h-5 text-orange-300" />
            <span>Home</span>
          </Link>

          {/* Friends */}
          <Link
            href="/friends"
            className="flex items-center gap-2 hover:text-rose-400 transition-all duration-300 hover:-translate-y-[1px]"
          >
            <Handshake className="w-5 h-5 text-orange-300" />
            <span>Friends</span>
          </Link>

          {/* Stories */}
          <Link
            href="/requests"
            className="flex items-center gap-2 hover:text-rose-400 transition-all duration-300 hover:-translate-y-[1px]"
          >
            <UserRoundPlus className="w-5 h-5 text-orange-300" />
            <span>Requests</span>
          </Link>
        </div>

        {/* Search (Desktop) */}
        {user && isLoaded && (
          <div
            onClick={toggleSearch}
            className="hidden xl:flex ml-5 p-2 bg-rose-700 rounded-xl items-center cursor-pointer transition-all duration-300 hover:bg-rose-600"
          >
            <input
              type="text"
              className="bg-transparent outline-none placeholder-rose-300 text-sm cursor-pointer"
              placeholder="Search users..."
              readOnly
            />
            <Search className="text-orange-300" />
          </div>
        )}
      </div>

      {/* Right Section (Auth + Mobile Search) */}
      <div className="w-[30%] flex justify-end items-center gap-4">
        {user && isLoaded && (
          <button
            onClick={toggleSearch}
            className="xl:hidden text-orange-300 hover:text-rose-400 transition-all duration-300"
          >
            <Search className="w-6 h-6" />
          </button>
        )}

        {/* Clerk Auth */}
        <ClerkLoading>
          <div className="flex items-center justify-center h-16">
            <div className="relative w-8 h-8">
              <div className="w-8 h-8 rounded-full border-t-4 border-b-4 border-gray-200"></div>
              <div className="absolute top-0 left-0 w-8 h-8 rounded-full border-t-4 border-b-4 border-orange-300 animate-spin"></div>
            </div>
          </div>
        </ClerkLoading>

        <ClerkLoaded>
          <SignedIn>
            <div className="flex items-center gap-3">
              <Link href="/chat">
                <MessagesSquare className="hidden sm:inline-flex text-orange-300 cursor-pointer hover:text-rose-400 transition-all duration-300" />
              </Link>
              <UserButton appearance={{ elements: { avatarBox: "w-8 h-8" } }} />
            </div>
          </SignedIn>

          <SignedOut>
            <Link
              href="/sign-in"
              className="flex items-center gap-2 text-sm text-rose-100 hover:text-rose-400 transition-all duration-300 hover:-translate-y-[1px]"
            >
              <LogIn className="w-5 h-5 text-orange-300" />
              <span>Login / Register</span>
            </Link>
          </SignedOut>
        </ClerkLoaded>

        <MobileMenu />
      </div>

      {/* Full-screen Search Overlay */}
      <div
        className={`fixed inset-0 z-50 flex flex-col items-center justify-start bg-rose-900 bg-opacity-95 pt-20 transition-all duration-500
        ${
          isSearchOpen
            ? "opacity-100 scale-100"
            : "opacity-0 scale-95 pointer-events-none"
        }`}
      >
        <div className="w-full max-w-lg p-4 rounded-lg shadow-xl">
          <div className="flex items-center gap-4 bg-rose-700 rounded-xl p-2">
            <Search className="text-orange-300" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search users..."
              value={query}
              onChange={handleQueryChange}
              className="flex-grow bg-transparent text-white placeholder-rose-200 outline-none"
            />
            <button onClick={toggleSearch}>
              <X className="text-rose-100 hover:text-orange-300 transition-colors" />
            </button>
          </div>
          <div className="mt-4 text-center">
            {query.trim() === "" ? (
              <p className="text-rose-200 text-sm">
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
                      className="flex items-center gap-4 p-3 mb-2 rounded-lg bg-rose-800 hover:bg-rose-700 transition-colors duration-200"
                    >
                      <Image
                        src={user.avatar || "/noAvatar.png"}
                        alt={user.username || "User"}
                        width={40}
                        height={40}
                        className="rounded-full object-cover w-10 h-10"
                      />
                      <div className="flex flex-col items-start">
                        <span className="font-semibold text-rose-100">
                          {user.name || user.username}
                        </span>
                        {user.name && (
                          <span className="text-xs text-rose-300">
                            @{user.username}
                          </span>
                        )}
                      </div>
                    </Link>
                  ))
                ) : (
                  <p className="text-rose-200 text-sm">No users found.</p>
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
