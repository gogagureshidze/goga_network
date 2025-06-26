"use client";
import { useState, useEffect } from "react";
import Link from "next/link";

function MobileMenu() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (isOpen) {
      document.body.classList.add("overflow-hidden");
    } else {
      document.body.classList.remove("overflow-hidden");
    }

    return () => {
      document.body.classList.remove("overflow-hidden");
    };
  }, [isOpen]);

  return (
    <div className="md:hidden">
      {/* Burger Icon */}
      <div
        className="flex flex-col gap-[4.5px] cursor-pointer z-50 relative"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div
          className={`w-6 h-1 bg-orange-300 rounded-sm origin-left transform transition duration-700 ${
            isOpen ? "rotate-45" : ""
          }`}
        ></div>
        <div
          className={`w-6 h-1 bg-orange-300 rounded-sm transition duration-700 ${
            isOpen ? "opacity-0" : ""
          }`}
        ></div>
        <div
          className={`w-6 h-1 bg-orange-300 rounded-sm origin-left transform transition duration-700 ${
            isOpen ? "-rotate-45" : ""
          }`}
        ></div>
      </div>

      {/* Dropdown Menu */}
      <div
        className={`fixed top-[96px] left-0 w-full z-40 flex flex-col items-center justify-center bg-rose-100 transition-all duration-700 ease-in-out ${
          isOpen
            ? "h-[calc(100vh)] opacity-95 pointer-events-auto"
            : "h-0 opacity-0 pointer-events-none overflow-hidden"
        }`}
      >
        {["Home", "Friends", "Profile", "Stories", "Login"].map((label, i) => (
          <Link
            key={label}
            href={`/${label === "Home" ? "" : label.toLowerCase()}`}
            onClick={() => setIsOpen(false)}
            className={`text-xl font-bold hover:text-rose-900 text-rose-800 my-2 transition-all duration-700 ease-in-out transform ${
              isOpen ? "opacity-100 translate-y-0" : "opacity-0 translate-y-5"
            } hover:-translate-y-[1px]`}
            style={{ transitionDelay: `${i * 100}ms` }}
          >
            {label}
          </Link>
        ))}
      </div>
      
    </div>
  );
}

export default MobileMenu;
