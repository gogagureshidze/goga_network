"use server";

import { auth } from "@clerk/nextjs/server";
import prisma from "@/lib/client";
import { revalidatePath } from "next/cache"; // 👈 ADD THIS IMPORT
export async function sharePost(postId: number, recipientIds: string[]) {
  const { userId } = await auth();

  if (!userId) {
    return { success: false, error: "Not authenticated" };
  }

  try {
    // Verify post exists
    const post = await prisma.post.findUnique({
      where: { id: postId },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            avatar: true,
          },
        },
        media: {
          select: {
            id: true,
            url: true,
            safeUrl: true,
            type: true,
          },
        },
        event: {
          select: {
            date: true,
            endDate: true,
            location: true,
          },
        },
        poll: {
          include: {
            options: {
              select: {
                id: true,
                text: true,
                _count: {
                  select: {
                    votes: true,
                  },
                },
              },
            },
          },
        },
        _count: {
          select: {
            likes: true,
            comments: true,
            shares: true,
          },
        },
      },
    });

    if (!post) {
      return { success: false, error: "Post not found" };
    }

    // Simplify post data to reduce size
    const simplifiedPost = {
      id: post.id,
      desc: post.desc?.substring(0, 500) || "", // Limit description length
      createdAt: post.createdAt.toISOString(),
      user: {
        id: post.user.id,
        username: post.user.username || "Unknown",
        avatar: post.user.avatar || "/noAvatar.png",
      },
      media: post.media.slice(0, 4).map((m) => ({
        url: m.safeUrl || m.url, // Use safeUrl if available, fallback to url
        type: m.type,
      })),
      event: post.event
        ? {
            date: post.event.date.toISOString(),
            location: post.event.location || null,
          }
        : null,
      poll: post.poll
        ? {
            options: post.poll.options.slice(0, 5).map((opt) => ({
              id: opt.id,
              text: opt.text,
              votesCount: opt._count.votes,
            })),
          }
        : null,
      _count: {
        likes: post._count.likes,
        comments: post._count.comments,
      },
    };

    const sharedData = {
      type: "shared_post",
      postId: post.id,
      post: simplifiedPost,
    };

    // Create conversations and messages for each recipient
    const messages = await Promise.all(
      recipientIds.map(async (recipientId) => {
        try {
          // Find or create conversation
          let conversation = await prisma.conversation.findFirst({
            where: {
              OR: [
                { user1Id: userId, user2Id: recipientId },
                { user1Id: recipientId, user2Id: userId },
              ],
            },
          });

          if (!conversation) {
            conversation = await prisma.conversation.create({
              data: {
                user1Id: userId,
                user2Id: recipientId,
              },
            });
          }

          // Create message with post data
          const message = await prisma.message.create({
            data: {
              conversationId: conversation.id,
              senderId: userId,
              receiverId: recipientId,
              text: `Shared a post from @${post.user.username}`,
              mediaUrl: JSON.stringify(sharedData),
              mediaType: "shared_post",
            },
          });

          return {
            message,
            recipientId,
            success: true,
          };
        } catch (err) {
          console.error(`Error sharing to ${recipientId}:`, err);
          return {
            recipientId,
            success: false,
            error: err instanceof Error ? err.message : "Unknown error",
          };
        }
      }),
    );

    const successfulMessages = messages.filter((m) => m.success);
    const failedMessages = messages.filter((m) => !m.success);

    if (failedMessages.length > 0) {
      console.error("Some shares failed:", failedMessages);
    }

    // 🆕 CREATE SHARE RECORD (allows multiple shares of same post)
    if (successfulMessages.length > 0) {
      try {
        // Create a new share record each time
        await prisma.share.create({
          data: {
            userId: userId,
            postId: postId,
          },
        });
        console.log(
          `✅ Share record created for user ${userId} sharing post ${postId}`,
        );
        revalidatePath("/");
      } catch (shareError) {
        console.error("Error creating share record:", shareError);
        // Don't fail the whole operation if share record fails
      }
    }

    return {
      success: successfulMessages.length > 0,
      messages: successfulMessages,
      sharedCount: successfulMessages.length,
      failedCount: failedMessages.length,
      error:
        successfulMessages.length === 0
          ? "Failed to share post to any recipients"
          : failedMessages.length > 0
            ? `Shared to ${successfulMessages.length}, failed for ${failedMessages.length}`
            : null,
    };
  } catch (error) {
    console.error("Error sharing post:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to share post. Please try again.",
    };
  }
}

export async function getFollowersForSharing() {
  const { userId } = await auth();

  if (!userId) {
    return [];
  }

  try {
    const followers = await prisma.follower.findMany({
      where: {
        followingId: userId,
      },
      include: {
        follower: {
          select: {
            id: true,
            username: true,
            avatar: true,
            name: true,
          },
        },
      },
    });

    return followers.map((f) => ({
      id: f.follower.id,
      username: f.follower.username || "Unknown",
      avatar: f.follower.avatar || "/noAvatar.png",
      name: f.follower.name || f.follower.username || "Unknown",
    }));
  } catch (error) {
    console.error("Error fetching followers:", error);
    return [];
  }
}
