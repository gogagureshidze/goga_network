import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/Navbar";
import { ClerkProvider } from "@clerk/nextjs";
import GlobalLoader from "@/components/GlobalLoader";
import PageTransition from "@/components/PageTransition";
import prisma from "@/lib/client";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Goga_Network Social Media App",
  description: "Social media app built with Next.js",
  
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Fetch all users from Prisma and select only the necessary fields
  const rawUsers = await prisma.user.findMany({
    select: {
      id: true,
      username: true,
      name: true,
      avatar: true,
    },
  });

  // Ensure all fields are strings (not null)
  const users = rawUsers.map(user => ({
    id: user.id,
    username: user.username ?? "",
    name: user.name ?? "",
    avatar: user.avatar ?? "",
  }));

  return (
    <html lang="en">
      <head>
        {/* Prevent mobile zoom on inputs by setting maximum-scale */}
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1.0, maximum-scale=1.0"
        />
      </head>
      <body className={inter.className}>
        <ClerkProvider>
          <div className="w-full px-4 text-orange-50 bg-rose-800 md:px-8 lg:px-16 xl:px-32 2xl:px-64">
            {/* Pass the fetched users to Navbar */}
            <Navbar users={users} />
          </div>
          <div className="md:px-8 px-4 text-gray-800 bg-rose-50 lg:px-16 xl:px-32 2xl:px-64">
            <GlobalLoader />
            <PageTransition>{children}</PageTransition>
          </div>
        </ClerkProvider>
      </body>
    </html>
  );
}
