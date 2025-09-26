// middleware.ts
import { clerkMiddleware } from "@clerk/nextjs/server";

export default clerkMiddleware();

export const config = {
  // Protect /settings and all its subpaths
  matcher: ["/settings/:path*"],
};
