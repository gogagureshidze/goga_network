"use server";

import { currentUser } from "@clerk/nextjs/server";
import prisma from "@/lib/client";
import { revalidateTag } from "next/cache";

export async function testAction(formData: FormData, media: any[]) {
  const user = await currentUser();
  if (!user) return;

  const desc = formData.get("desc") as string;

  try {
    const res = await prisma.post.create({
      data: {
        userId: user.id,
        desc,
        media: {
          createMany: {
            data: media.map((file) => ({
              url: file.secure_url,
              safeUrl: file.playback_url ?? null, // null is valid if no playback url
              type: file.resource_type === "video" ? "video" : "photo",
            })),
          },
        },
      },
      include: {
        media: true,
      },
    });

    console.log("✅ Post created:", res);

    // 🔥 Invalidate cached feeds & profiles
    revalidateTag("feed-posts");
    revalidateTag("profile-posts");

    return res;
  } catch (error) {
    console.error("❌ Prisma error creating post:", error);
    throw error;
  }
}
