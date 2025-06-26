"use client";
import Link from "next/link";
import MobileMenu from "./MobileMenu";
import {
  House,
  Handshake,
  SquareLibrary,
  UsersRound,
  MessagesSquare,
  BellRing,
  Search,
  LogIn,
} from "lucide-react";
import {
  ClerkLoaded,
  ClerkLoading,
  SignedIn,
  SignedOut,
  UserButton,
} from "@clerk/nextjs";

function Navbar() {
  return (
    <div className="h-24 flex justify-between items-center px-4 md:px-12 bg-rose-800 text-rose-100">
      {/* Logo: small and large screens only */}
      <div className="block md:hidden lg:block w-[30%]">
        <Link
          href="/"
          className="font-bold uppercase text-xl text-orange-300 tracking-wide"
        >
          Goga.Network
        </Link>
      </div>

      {/* Navigation Links */}
      <div className="hidden md:flex w-[40%] justify-center text-sm justify-between">
        <div className="flex gap-8 items-center">
          {/* Home */}
          <Link
            href="/"
            className="flex items-center gap-2 transform transition-all duration-300 hover:-translate-y-[1px] hover:text-rose-400"
          >
            <House className="w-5 h-5 text-orange-300" />
            <span>Home</span>
          </Link>

          {/* Friends */}
          <Link
            href="/friends"
            className="flex items-center gap-2 transform transition-all duration-300 hover:-translate-y-[1px] hover:text-rose-400"
          >
            <Handshake className="w-5 h-5 text-orange-300" />
            <span>Friends</span>
          </Link>

          {/* Stories */}
          <Link
            href="/stories"
            className="flex items-center gap-2 transform transition-all duration-300 hover:-translate-y-[1px] hover:text-rose-400"
          >
            <SquareLibrary className="w-5 h-5 text-orange-300" />
            <span>Stories</span>
          </Link>
        </div>
        <div className="hidden xl:flex ml-5 p-2 bg-rose-700 rounded-xl items-center">
          <input
            type="text"
            className="bg-transparent outline-none "
            placeholder="Search..."
          ></input>
          <Search className="text-orange-300 "></Search>
        </div>
      </div>

      {/* Auth & Mobile Menu */}
      <div className="w-[30%] flex justify-end items-center gap-4">
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
              <UsersRound className="hidden sm:inline-flex text-orange-300 cursor-pointer transition-all duration-300 hover:-translate-y-[1px] hover:text-rose-400" />
              <MessagesSquare className="hidden sm:inline-flex text-orange-300 cursor-pointer transition-all duration-300 hover:-translate-y-[1px] hover:text-rose-400" />
              <BellRing className="hidden sm:inline-flex text-orange-300 cursor-pointer transition-all duration-300 hover:-translate-y-[1px] hover:text-rose-400" />

              <UserButton />
            </div>
          </SignedIn>

          <SignedOut>
            <Link
              href="/sign-in"
              className="flex items-center gap-2 text-sm text-rose-100 hover:text-rose-400 transform transition-all duration-300 hover:-translate-y-[1px]"
            >
              <LogIn className="w-5 h-5 text-orange-300" />
              <span>Login / Register</span>
            </Link>
          </SignedOut>
        </ClerkLoaded>

        <MobileMenu />
      </div>
    </div>
  );
}

export default Navbar;
