import prisma from "@/lib/client";
import { currentUser } from "@clerk/nextjs/server";
import MediaGallery from "@/components/MediaGallery";
import { notFound } from "next/navigation";

interface SeeAllMediaProps {
  params: { id: string };
}

export default async function SeeAllMedia({ params }: SeeAllMediaProps) {
  const { id } = params;
  if (!id) return null;
  const authUser = await currentUser();
  const currentUserId = authUser?.id ?? null;

  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) notFound();

  const postsWithMedia = await prisma.post.findMany({
    where: { userId: user.id, media: { some: {} } },
    include: { media: true },
    orderBy: { createdAt: "desc" },
  });

  const allMedia = postsWithMedia.flatMap((post) => post.media);

  return (
    <MediaGallery
      allMedia={allMedia}
      userName={
        user.name
          ? user.surname
            ? `${user.name} ${user.surname}`
            : user.name
          : user.username ?? "Unknown"
      }
      id={id}
      currentUserId={currentUserId}
    />
  );
}
