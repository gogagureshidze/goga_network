/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  reactCompiler: true,
  // Next logs Server Action arguments by default in development. They can
  // contain message text and push credentials; keep request/error diagnostics only.
  logging: { serverFunctions: false },
  // Prisma 5's dynamic runtime lookup can otherwise trace local environment files.
  outputFileTracingExcludes: {
    '/*': ['./.env*', './.git/**/*', './.local/**/*', './public/local-test/**/*', './*.pem', './*.key', './tests/**/*', './docs/**/*', './ops/**/*', './.github/**/*'],
  },
  async headers() {
    return [{ source: '/(.*)', headers: [
      {key:'X-Content-Type-Options',value:'nosniff'},
      {key:'X-Frame-Options',value:'DENY'},
      {key:'Referrer-Policy',value:'strict-origin-when-cross-origin'},
      {key:'Permissions-Policy',value:'camera=(self), microphone=(self), display-capture=(self)'},
    ] }];
  },
  images: {
    loader: "custom",
    loaderFile: "./src/lib/cloudinaryLoader.ts",
    remotePatterns: [
      { protocol: "https", hostname: "static.wikia.nocookie.net" },
      { protocol: "https", hostname: "instagram.ftbs10-1.fna.fbcdn.net" },
      { protocol: "https", hostname: "static.vecteezy.com" },
      { protocol: "https", hostname: "img.clerk.com" },
      { protocol: "https", hostname: "res.cloudinary.com" },
    ],
  },
};

export default nextConfig;
