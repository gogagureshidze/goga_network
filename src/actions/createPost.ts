"use server";

import { currentUser } from "@clerk/nextjs/server";
import prisma from "@/lib/client";
import { revalidateTag } from "next/cache";

export async function testAction(formData: FormData, media: any[]) {
  const user = await currentUser();
  if (!user) return;

  const desc = formData.get("desc") as string;

  try {
    // 1. Create the post first
    const res = await prisma.post.create({
      data: {
        userId: user.id,
        desc,
        media: {
          createMany: {
            data: media.map((file) => ({
              url: file.secure_url,
              safeUrl: file.playback_url ?? null,
              type: file.resource_type === "video" ? "video" : "photo",
            })),
          },
        },
      },
      include: {
        media: true,
      },
    });

    // 2. Extract @mentions from description
    const mentionRegex = /@(\w+)/g;
    const mentions = [...desc.matchAll(mentionRegex)].map((m) => m[1]);

    if (mentions.length > 0) {
      // 3. Find users that exist AND are followed by the post author
      const validUsers = await prisma.user.findMany({
        where: {
          username: { in: mentions },
        },
        select: { id: true, username: true },
      });

      // 4. Create tags for valid users
      if (validUsers.length > 0) {
        await prisma.postTag.createMany({
          data: validUsers.map((u) => ({
            postId: res.id,
            userId: u.id,
          })),
          skipDuplicates: true,
        });
      }
    }

    console.log("✅ Post created:", res);
    // @ts-ignore
    revalidateTag("feed-posts");
    // @ts-ignore
    revalidateTag("profile-posts");

    return res;
  } catch (error) {
    console.error("❌ Prisma error creating post:", error);
    throw error;
  }
}
