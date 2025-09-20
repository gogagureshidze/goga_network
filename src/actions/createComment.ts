"use server";

import { currentUser } from "@clerk/nextjs/server";
import { revalidatePath, revalidateTag } from "next/cache"; // 👈 Don't forget this import
import prisma from "@/lib/client";

export const addComment = async (postId: number, desc: string) => {
  const user = await currentUser();
  const userId = user?.id;

  if (!userId) {
    throw new Error("User is not authenticated!");
  }

  try {
    const createdComment = await prisma.comment.create({
      data: {
        desc,
        userId,
        postId,
      },
      include: {
        user: true,
      },
    });

    // THIS IS THE CRITICAL LINE OF CODE
    // It tells Next.js to re-fetch the data for the current page.
          revalidateTag("feed-posts");
                revalidateTag("profile-posts");
    
    revalidatePath("/");

    return createdComment;
  } catch (err) {
    console.log(err);
    throw new Error("Something went wrong!");
  }
};
