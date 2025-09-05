"use server";
import prisma from "@/lib/client";
import { currentUser } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";

export const switchLike = async (postId: number) => {
  const user = await currentUser();
  const currentUserId = user?.id;

  if (!currentUserId) throw new Error("User is not authenticated!");

  try {
    const existingLike = await prisma.like.findFirst({
      where: {
        postId,
        userId: currentUserId,
      },
    });

    if (existingLike) {
      await prisma.like.delete({
        where: { id: existingLike.id },
      });
    } else {
      await prisma.like.create({
        data: {
          postId,
          userId: currentUserId,
        },
      });
    }

    revalidatePath("/");
  } catch (err) {
    console.error(err);
    throw new Error("Something went wrong");
  }
};
