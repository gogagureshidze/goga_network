/** @type {import('next').NextConfig} */

import withPWA from "next-pwa";

const nextConfig = {
  experimental: {
    reactCompiler: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "static.wikia.nocookie.net",
      },
      {
        protocol: "https",
        hostname: "instagram.ftbs10-1.fna.fbcdn.net",
      },
      {
        protocol: "https",
        hostname: "static.vecteezy.com",
      },
      {
        protocol: "https",
        hostname: "img.clerk.com",
      },
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
      },
    ],
  },
};

// ✅ Wrap config with PWA
const withPWAConfig = withPWA({
  dest: "public",
  register: true,
  skipWaiting: true,
});

export default withPWAConfig(nextConfig);
