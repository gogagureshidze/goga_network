// app/layout.tsx

import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/Navbar";
import { ClerkProvider } from "@clerk/nextjs";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Goga_Network",
  description: "Social media app built with Next.js",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider>
      <div className={inter.className}>
        <div className="w-full px-4 text-orange-50 bg-rose-800 md:px-8 lg:px-16 xl:px-32 2xl:px-64">
          <Navbar />
        </div>
        <div className="md:px-8 px-4 text-gray-800 bg-rose-50 lg:px-16 xl:px-32 2xl:px-64">
          {children}
        </div>
      </div>
    </ClerkProvider>
  );
}
