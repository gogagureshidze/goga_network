"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { Twitter, Facebook, Instagram, Github, Network } from "lucide-react";

const Footer = () => {
  const pathname = usePathname();

  // Hide footer on /chat and nested chat pages
  if (pathname.startsWith("/chat")) return null;

  return (
    <footer className="bg-rose-100 text-rose-900 py-12 px-6 sm:px-12 border-t border-rose-200 shadow-lg font-sans">
      <div className="container mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10">
          {/* Logo and Tagline */}
          <div>
            <div className="flex items-center space-x-2 mb-3">
              <Network className="text-rose-800 w-7 h-7" />
              <span className="text-xl font-bold text-rose-800">
                Goga_Network
              </span>
            </div>
            <p className="text-sm text-gray-700 leading-relaxed">
              Connecting the world, one post at a time.
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="text-lg font-semibold text-rose-800 mb-4">
              Quick Links
            </h4>
            <ul className="space-y-2">
              <li>
                <Link
                  href="/"
                  className="hover:text-rose-950 transition-colors duration-300"
                >
                  Home
                </Link>
              </li>
              <li>
                <Link
                  href="/chat"
                  className="hover:text-rose-950 transition-colors duration-300"
                >
                  Chats
                </Link>
              </li>

              <li>
                <Link
                  href="/requests"
                  className="hover:text-rose-950 transition-colors duration-300"
                >
                  Requests
                </Link>
              </li>
              <li>
                <Link
                  href="/friends"
                  className="hover:text-rose-950 transition-colors duration-300"
                >
                  Friends
                </Link>
              </li>
            </ul>
          </div>

          {/* Legal & Help */}
          <div>
            <h4 className="text-lg font-semibold text-rose-800 mb-4">
              Legal & Help
            </h4>
            <ul className="space-y-2">
              <li>
                <Link
                  href="/privacy"
                  className="hover:text-rose-950 transition-colors duration-300"
                >
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link
                  href="/service"
                  className="hover:text-rose-950 transition-colors duration-300"
                >
                  Terms of Service
                </Link>
              </li>
              <li>
                <Link
                  href="/guide"
                  className="hover:text-rose-950 transition-colors duration-300"
                >
                  Community Guidelines
                </Link>
              </li>
              <li>
                <Link
                  href="/contact"
                  className="hover:text-rose-950 transition-colors duration-300"
                >
                  Contact Us
                </Link>
              </li>
            </ul>
          </div>

          {/* Social */}
          <div>
            <h4 className="text-lg font-semibold text-rose-800 mb-4">
              Follow Us
            </h4>
            <div className="flex space-x-4">
              <a
                href="https://www.facebook.com/goga.gureshidze.2025"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Facebook"
                className="text-orange-600 hover:text-rose-800 transition-transform transform hover:scale-110"
              >
                <Facebook className="w-6 h-6" />
              </a>
              <a
                href="https://www.instagram.com/goga_gureshidze/"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Instagram"
                className="text-orange-600 hover:text-rose-800 transition-transform transform hover:scale-110"
              >
                <Instagram className="w-6 h-6" />
              </a>
              <a
                href="https://github.com/gogagureshidze"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="GitHub"
                className="text-orange-600 hover:text-rose-800 transition-transform transform hover:scale-110"
              >
                <Github className="w-6 h-6" />
              </a>
            </div>
          </div>
        </div>

        {/* Bottom line */}
        <div className="mt-10 text-center text-sm border-t border-rose-200 pt-6 text-gray-700">
          <p>
            &copy; {new Date().getFullYear()} Goga Network. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
