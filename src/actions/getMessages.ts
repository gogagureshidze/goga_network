// src/actions/getMessages.ts
"use server";

import { PrismaClient } from "@/generated/prisma";
import { currentUser } from "@clerk/nextjs/server";

const prisma = new PrismaClient();

export async function getMessages(friendId: string) {
  try {
     const user = await currentUser()
     if(!user) return null
     const userId = user.id

    if (!userId) {
      throw new Error("Unauthorized");
    }

    // Find the conversation between the two users, regardless of who initiated it.
    const conversation = await prisma.conversation.findFirst({
      where: {
        OR: [
          { user1Id: userId, user2Id: friendId },
          { user1Id: friendId, user2Id: userId },
        ],
      },
      include: {
        messages: {
          orderBy: {
            createdAt: "asc",
          },
        },
      },
    });

    if (!conversation) {
      return []; // Return an empty array if no conversation exists
    }

    // Return the messages directly from the conversation object
    return conversation.messages.map((msg) => ({
      ...msg,
      isOwn: msg.senderId === userId,
    }));
  } catch (error) {
    console.error("Failed to fetch messages:", error);
    return [];
  }
}
