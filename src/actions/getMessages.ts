"use server";

import { auth } from "@clerk/nextjs/server";
import prisma from "@/lib/client";

const PAGE_SIZE = 10;

export async function getMessages(friendId: string, olderThan?: number) {
  const { userId } = await auth();
  if (!userId) return null;

  const conversation = await prisma.conversation.findFirst({
    where: {
      OR: [
        { user1Id: userId, user2Id: friendId },
        { user1Id: friendId, user2Id: userId },
      ],
    },
  });

  if (!conversation) return { messages: [], hasMore: false };

  const raw = await prisma.message.findMany({
    where: {
      conversationId: conversation.id,
      ...(olderThan ? { id: { lt: olderThan } } : {}),
    },
    orderBy: { id: "desc" },
    take: PAGE_SIZE + 1,
  });

  const hasMore = raw.length > PAGE_SIZE;
  if (hasMore) raw.pop();

  // Return chronological order (oldest → newest)
  return { messages: raw.reverse(), hasMore };
}
