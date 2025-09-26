// src/app/layout.tsx

import type { Metadata } from "next";
import { Funnel_Display } from "next/font/google";
import "./globals.css";
import ClickSpark from "@/components/ClickSpark";
import Navbar from "@/components/Navbar";
import PageTransition from "@/components/PageTransition";
import prisma from "@/lib/client";
import Providers from "./providers";
import Footer from "@/components/Footer";
import GlobalLoader from "@/components/GlobalLoader";
import { SocketProvider } from "@/context/SocketContext";

// Define the Funnel Display font with the variable property
const funnel_display = Funnel_Display({
  subsets: ["latin"],
  variable: "--font-funnel-display",
});

export const metadata: Metadata = {
  title: "Goga_Network Social Media App",
  description: "Social media app built with Next.js",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Your data fetching is fine and can remain here
  const rawUsers = await prisma.user.findMany({
    select: {
      id: true,
      username: true,
      name: true,
      avatar: true,
    },
  });

  const users = rawUsers.map((user) => ({
    id: user.id,
    username: user.username ?? "",
    name: user.name ?? "",
    avatar: user.avatar ?? "",
  }));

  return (
    <html lang="en" className={funnel_display.variable}>
      <head>
        <link rel="preconnect" href="https://img.clerk.com" />
        <link
          rel="preconnect"
          href="https://faithful-goblin-72.clerk.accounts.dev"
        />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1.0, maximum-scale=1.0"
        />
      </head>
      <body className="font-sans">
        <Providers>
          <SocketProvider>
            <ClickSpark
              sparkColor="#e65800ff"
              sparkSize={10}
              sparkRadius={15}
              sparkCount={8}
              duration={500}
            >
              <div className="w-full px-4 text-orange-50 bg-rose-800 md:px-8 lg:px-16 xl:px-32 2xl:px-64">
                <Navbar users={users} />
              </div>
              <div className="md:px-8 px-4 text-gray-800 bg-rose-50 lg:px-16 xl:px-32 2xl:px-64 pb-4">
                <GlobalLoader />
                <PageTransition>{children}</PageTransition>
              </div>
              <Footer />
            </ClickSpark>
          </SocketProvider>
        </Providers>
      </body>
    </html>
  );
}
