"use server";

import { auth } from "@clerk/nextjs/server";
import prisma from "@/lib/client";
import { chatService } from "@/lib/chat-server";
import { assertCanViewPost } from "@/lib/social-access";
import { consumeRequestLimit } from '../../server/request-limits';
import { revalidatePath } from "next/cache"; // 👈 ADD THIS IMPORT
export async function sharePost(postId: number, recipientIds: string[]) {
  const { userId } = await auth();

  if (!userId) {
    return { success: false, error: "Not authenticated" };
  }

  try {
    if (!Array.isArray(recipientIds) || recipientIds.length === 0 || recipientIds.length > 20) throw new Error("Choose 1 to 20 recipients");
    if (!Number.isSafeInteger(postId) || postId < 1 || recipientIds.some(id => typeof id !== 'string' || !id || id.length > 191)) throw new Error("Invalid recipients");
    recipientIds = [...new Set(recipientIds)];
    consumeRequestLimit(userId, 'share', recipientIds.length);
    await assertCanViewPost(userId, postId);
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
          await assertCanViewPost(recipientId, postId);
          const conversation = await chatService.getOrCreateDirect(userId, recipientId);

          // Create message with post data
          const message = await prisma.$transaction(async tx => {
            await tx.conversation.update({ where: { id: conversation.id }, data: { updatedAt: new Date() } });
            await chatService.authorizeConversation(userId, conversation.id, tx);
            return tx.message.create({
            data: {
              conversationId: conversation.id,
              senderId: userId,
              receiverId: recipientId,
              text: `Shared a post from @${post.user.username}`,
              mediaUrl: JSON.stringify(sharedData),
              mediaType: "shared_post",
            },
            });
          });

          return {
            message,
            recipientId,
            success: true,
          };
        } catch (err) {
          console.warn(JSON.stringify({event:"chat.share_recipient_failed"}));
          return {
            recipientId,
            success: false,
            error: "Unable to share with this recipient",
          };
        }
      }),
    );

    const successfulMessages = messages.filter((m) => m.success);
    const failedMessages = messages.filter((m) => !m.success);

    if (failedMessages.length > 0) {
      console.warn(JSON.stringify({event:"chat.share_partial_failure",count:failedMessages.length}));
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

        revalidatePath("/");
      } catch (shareError) {
        console.warn(JSON.stringify({event:"chat.share_record_failed"}));
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
    console.warn(JSON.stringify({event:"chat.share_failed"}));
    return {
      success: false,
      error: error instanceof Error && "code" in error && error.code === "RATE_LIMITED" ? "Too many shares. Please try again shortly." : "Failed to share post. Please try again.",
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

