
import withPWAInit from "@ducanh2912/next-pwa";

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  experimental: {
    reactCompiler: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "static.wikia.nocookie.net" },
      { protocol: "https", hostname: "instagram.ftbs10-1.fna.fbcdn.net" },
      { protocol: "https", hostname: "static.vecteezy.com" },
      { protocol: "https", hostname: "img.clerk.com" },
      { protocol: "https", hostname: "res.cloudinary.com" },
    ],
  },
};

// 👇 Initialize the wrapper
const withPWA = withPWAInit({
  dest: "public",
  register: true,
  skipWaiting: true,
  disable: false, // Enable in dev to generate sw.js
  importScripts: ["/custom-sw.js"], // Your custom logic
});

// export default withPWA(nextConfig);
export default nextConfig;