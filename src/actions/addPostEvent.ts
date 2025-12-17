"use server";

import { currentUser } from "@clerk/nextjs/server";
import prisma from "@/lib/client";
import { revalidateTag } from "next/cache";

interface EventInput {
  date: Date;
  endDate?: Date;
  location?: string;
  latitude?: number;
  longitude?: number;
}

interface AddEventPostInput {
  userId: string;
  desc: string;
  media?: { url: string; type: string }[];
  event: EventInput;
}

export async function addEventPost(data: AddEventPostInput) {
  const user = await currentUser();
  if (!user || user.id !== data.userId) {
    throw new Error("Unauthorized");
  }

  const { userId, desc, media, event } = data;

  try {
    // 1. Create Post with Event
    const createdPost = await prisma.post.create({
      data: {
        desc,
        userId,
        media:
          media && media.length > 0
            ? {
                createMany: {
                  data: media.map((m) => ({
                    url: m.url,
                    safeUrl: null,
                    type: m.type,
                  })),
                },
              }
            : undefined,
        event: {
          create: {
            date: event.date,
            endDate: event.endDate || null,
            location: event.location || null,
            latitude: event.latitude || null,
            longitude: event.longitude || null,
          },
        },
      },
      include: {
        media: true,
        event: true,
        user: true,
      },
    });

    // 2. Extract @mentions and create tags
    const mentionRegex = /@(\w+)/g;
    const mentions = [...desc.matchAll(mentionRegex)].map((m) => m[1]);

    if (mentions.length > 0) {
      const validUsers = await prisma.user.findMany({
        where: {
          username: { in: mentions },
        },
        select: { id: true, username: true },
      });

      if (validUsers.length > 0) {
        await prisma.postTag.createMany({
          data: validUsers.map((u) => ({
            postId: createdPost.id,
            userId: u.id,
          })),
          skipDuplicates: true,
        });
      }
    }

    console.log("✅ Event post created:", createdPost);
    // @ts-ignore
    revalidateTag("feed-posts");
    // @ts-ignore
    revalidateTag("profile-posts");

    return createdPost;
  } catch (error) {
    console.error("❌ Prisma error creating event post:", error);
    throw error;
  }
}
