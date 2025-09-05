/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    reactCompiler: true,
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
        hostname: "img.clerk.com", // ✅ Added Clerk image host
      },
      {
        protocol: "https",
        hostname: "res.cloudinary.com", // ✅ Added Clerk image host
      },
    ],
  },
};

export default nextConfig;
