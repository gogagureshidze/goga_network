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
  // Verify user is authenticated
  const user = await currentUser();
  if (!user || user.id !== data.userId) {
    throw new Error("Unauthorized");
  }

  const { userId, desc, media, event } = data;

  try {
    // Create Post with Event in a single transaction
    const createdPost = await prisma.post.create({
      data: {
        desc,
        userId,
        // Create media if provided
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
        // Create event linked to this post
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

    console.log("✅ Event post created:", createdPost);

    // Invalidate cached feeds & profiles
    revalidateTag("feed-posts");
    revalidateTag("profile-posts");

    return createdPost;
  } catch (error) {
    console.error("❌ Prisma error creating event post:", error);
    throw error;
  }
}
