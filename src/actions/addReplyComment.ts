"use server";

import prisma from "@/lib/client";
import { currentUser } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";


export async function addReplyComment(
  postId: number,
  desc: string,
  parentId?: number
) {
const user = await currentUser();
const userId = user?.id;

  if (!userId) {
    throw new Error("User is not authenticated!");
  }

  try {
    await prisma.comment.create({
      data: {
        desc,
        userId,
        postId,
        parentId,
      },
    });

    // Revalidate the path to fetch the new comment data from the server.
    revalidatePath("/");
  } catch (err) {
    console.error(err);
    throw new Error("Something went wrong");
  }
}
