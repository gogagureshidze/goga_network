import prisma from "@/lib/client";
import { currentUser } from "@clerk/nextjs/server";
// import Image from "next/image"; // No longer needed here
import MediaGallery from "@/components/MediaGallery"; // 1. IMPORT the client component

async function SeeAllMedia() {
  const user = await currentUser();
  // Ensure the user exists before continuing, otherwise return null
  if (!user) return null;

  const userId = user.id;
  // Use a nullish coalescing operator to ensure a safe default for the name
  const userName = user.fullName ?? user.username ?? "Guest";

  const userMedia = await prisma.post.findMany({
    where: {
      userId,
      media: {
        some: {},
      },
    },
    include: {
      media: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  const allMedia = userMedia.flatMap((post) => post.media);

  // 2. RENDER the client component, passing the data as props
  return <MediaGallery allMedia={allMedia} userName={userName} />;
}

export default SeeAllMedia;
