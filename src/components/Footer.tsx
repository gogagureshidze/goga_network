'use client'

import { usePathname } from "next/navigation";


const Footer = () => {
  const pathname = usePathname();

  // Hide footer on /chat and nested chat pages
  if (pathname.startsWith("/chat")) return null;

  return (
    <footer className="bg-rose-100 text-rose-900 py-12 px-6 sm:px-12 border-t border-rose-200 shadow-lg font-sans ">
      <div className="container mx-auto">
        {/* Grid layout for better alignment */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10">
          {/* Logo and Tagline */}
          <div>
            <div className="flex items-center space-x-2 mb-3">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="28"
                height="28"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-rose-800"
              >
                <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
                <rect x="2" y="14" width="4" height="7" />
                <circle cx="4" cy="7" r="4" />
              </svg>
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
              {["Home", "Profile", "Messages", "Notifications", "Settings"].map(
                (link) => (
                  <li key={link}>
                    <a
                      href="#"
                      className="hover:text-rose-950 transition-colors duration-300"
                    >
                      {link}
                    </a>
                  </li>
                )
              )}
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4 className="text-lg font-semibold text-rose-800 mb-4">Legal</h4>
            <ul className="space-y-2">
              {[
                "Privacy Policy",
                "Terms of Service",
                "Community Guidelines",
                "Help Center",
              ].map((link) => (
                <li key={link}>
                  <a
                    href="#"
                    className="hover:text-rose-950 transition-colors duration-300"
                  >
                    {link}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Social */}
          <div>
            <h4 className="text-lg font-semibold text-rose-800 mb-4">
              Follow Us
            </h4>
            <div className="flex space-x-4">
              {["twitter", "facebook", "instagram", "github"].map((icon) => (
                <a
                  key={icon}
                  href="#"
                  aria-label={icon}
                  className="text-orange-600 hover:text-rose-800 transition-transform transform hover:scale-110"
                >
                  <i className={`fa-brands fa-${icon} text-2xl`} />
                </a>
              ))}
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
