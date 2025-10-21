"use server";

import { auth } from "@clerk/nextjs/server";
import prisma from "@/lib/client";
import { revalidateTag } from "next/cache";

export async function togglePrivateAccount() {
  const { userId } = await auth();

  if (!userId) {
    throw new Error("Not authenticated");
  }

  const currentUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { isPrivate: true },
  });

  if (!currentUser) {
    throw new Error("User not found");
  }

  await prisma.user.update({
    where: { id: userId },
    data: { isPrivate: !currentUser.isPrivate },
  });

  revalidateTag("user-profile");
  revalidateTag("feed-posts");

  return { success: true, isPrivate: !currentUser.isPrivate };
}
