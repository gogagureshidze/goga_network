"use server";

import { auth } from "@clerk/nextjs/server";
import prisma from "@/lib/client";

const PAGE_SIZE = 10;

export async function getMessages(
  friendId: string,
  cursor?: number, // message ID to paginate from (exclusive)
  limit: number = PAGE_SIZE
) {
  const { userId } = await auth();
  if (!userId) return null;

  // Find the conversation between these two users
  const conversation = await prisma.conversation.findFirst({
    where: {
      OR: [
        { user1Id: userId, user2Id: friendId },
        { user1Id: friendId, user2Id: userId },
      ],
    },
  });

  if (!conversation) return { messages: [], hasMore: false };

  // Fetch one extra to know if there are more
  const messages = await prisma.message.findMany({
    where: {
      conversationId: conversation.id,
      // If cursor provided, get messages OLDER than that ID
      ...(cursor ? { id: { lt: cursor } } : {}),
    },
    orderBy: { id: "desc" }, // newest first so we can slice efficiently
    take: limit + 1,
  });

  const hasMore = messages.length > limit;
  if (hasMore) messages.pop(); // remove the extra item

  // Return in chronological order (oldest first) for rendering
  return {
    messages: messages.reverse(),
    hasMore,
  };
}