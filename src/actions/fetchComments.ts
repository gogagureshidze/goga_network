// lib/actions.ts
"use server";

import prisma from "@/lib/client";
import { currentUser } from "@clerk/nextjs/server";
import { unstable_cache } from "next/cache";
import { assertCanViewPost } from "@/lib/social-access";

// ... (all your other code, like postSelectFields and fetchPosts, stays here)
// ...

// 🔽 PASTE THIS NEW FUNCTION AT THE END 🔽

export async function fetchComments(postId: number) {
  try {
    // We can safely get the user here because this is a "server" function
    const user = await currentUser();
    const username = user?.username;
    await assertCanViewPost(user?.id, postId);

    // We can safely use prisma here
    const comments = await prisma.comment.findMany({
      where: {
        postId,
      },
      include: {
        user: true,
        likes: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    // Return the data to the client
    return { comments, username };
  } catch (error) {
    console.error("Failed to fetch comments:", error);
    // Always return a value even on error
    return { comments: [], username: undefined };
  }
}
