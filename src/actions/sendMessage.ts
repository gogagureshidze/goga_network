// src/actions/sendMessage.ts
"use server";

import { PrismaClient } from "@/generated/prisma";
import { currentUser } from "@clerk/nextjs/server";

const prisma = new PrismaClient();

export async function sendMessage({
  receiverId,
  text,
  mediaUrl,
  mediaType,
}: {
  receiverId: string;
  text?: string;
  mediaUrl?: string;
  mediaType?: string;
}) {
  try {
    const user = await currentUser();
    if (!user) return null;
    const userId = user.id;
    if (!userId) {
      throw new Error("Unauthorized");
    }

    // Find the conversation or create a new one
    const conversation = await prisma.conversation.findFirst({
      where: {
        OR: [
          { user1Id: userId, user2Id: receiverId },
          { user1Id: receiverId, user2Id: userId },
        ],
      },
    });

    let conversationId;
    if (conversation) {
      conversationId = conversation.id;
    } else {
      // Create a new conversation if it doesn't exist
      const newConversation = await prisma.conversation.create({
        data: {
          user1Id: userId,
          user2Id: receiverId,
        },
      });
      conversationId = newConversation.id;
    }

    // Create the new message
    const newMessage = await prisma.message.create({
      data: {
        conversationId: conversationId,
        senderId: userId,
        receiverId: receiverId,
        text: text,
        mediaUrl: mediaUrl,
        mediaType: mediaType,
      },
    });

    return newMessage;
  } catch (error) {
    console.error("Failed to send message:", error);
    throw new Error("Failed to send message");
  }
}
