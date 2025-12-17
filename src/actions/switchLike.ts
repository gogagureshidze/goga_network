"use server";

import prisma from "@/lib/client";
import { currentUser } from "@clerk/nextjs/server";
import { revalidatePath, revalidateTag } from "next/cache";
import webpush from "web-push";

// 1. Configure Web Push (Moved outside to run once)
if (process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || "mailto:noreply@goganetwork.com",
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
}

// In-memory lock
const likeLocks = new Map<string, Promise<any>>();

export const switchLike = async (postId: number, shouldLike?: boolean) => {
  const user = await currentUser();
  const currentUserId = user?.id;

  if (!currentUserId) {
    return {
      success: false,
      error: "User is not authenticated",
      likeUserIds: [],
      likeCount: 0,
    };
  }

  const lockKey = `${currentUserId}-${postId}`;

  // Wait for existing lock
  if (likeLocks.has(lockKey)) {
    try {
      await likeLocks.get(lockKey);
    } catch {
      console.log("Previous like operation failed, proceeding with new one");
    }
  }

  const operationPromise = performLikeOperation(
    currentUserId,
    postId,
    shouldLike
  );
  likeLocks.set(lockKey, operationPromise);

  try {
    const result = await operationPromise;

    // ---------------------------------------------------------
    // 2. TRIGGER PUSH NOTIFICATION
    // ---------------------------------------------------------
    if (result.success && result.isLiked) {
      // Determine the best name to show
      // Tries: "goga_dev" -> "Goga" -> "Someone"
      const likerName = user.username || user.firstName || "Someone";

      // Fire and forget (don't await) so the UI stays fast
      sendLikeNotification(currentUserId, likerName, postId).catch((err) =>
        console.error("Background notification failed:", err)
      );
    }
    // ---------------------------------------------------------

    return result;
  } finally {
    likeLocks.delete(lockKey);
  }
};

/**
 * Helper to send the notification
 */
async function sendLikeNotification(
  likerId: string,
  likerName: string,
  postId: number
) {
  try {
    // A. Find the post to get the author's ID
    const post = await prisma.post.findUnique({
      where: { id: postId },
      select: { userId: true }, // Ensure this matches your schema (authorId vs userId)
    });

    // B. Stop if post missing or user liked their own post
    if (!post || post.userId === likerId) return;

    // C. Get author's subscriptions
    const subscriptions = await prisma.pushSubscription.findMany({
      where: { userId: post.userId },
    });

    if (subscriptions.length === 0) return;

    // D. Prepare payload with the dynamic name
    const payload = JSON.stringify({
      title: "New Like", // Title of the popup
      body: `${likerName} liked your post!`, // The message body
      url: `/post/${postId}`, // Clicking opens the post
      icon: "/icons/icon-192x192.png",
      badge: "/icons/icon-96x96.png", // Small icon for Android status bar
    });

    // E. Send to all user's devices
    const notifications = subscriptions.map((sub) =>
      webpush
        .sendNotification(
          {
            endpoint: sub.endpoint,
            keys: {
              p256dh: sub.p256dh,
              auth: sub.auth,
            },
          },
          payload
        )
        .catch(async (err) => {
          // Cleanup invalid subscriptions
          if (err.statusCode === 410 || err.statusCode === 404) {
            console.log(`Cleaning up stale subscription: ${sub.id}`);
            await prisma.pushSubscription.delete({ where: { id: sub.id } });
          } else {
            console.error("Error sending push notification:", err);
          }
        })
    );

    await Promise.all(notifications);
  } catch (error) {
    console.error("Fatal error in notification flow:", error);
  }
}

async function performLikeOperation(
  currentUserId: string,
  postId: number,
  shouldLike?: boolean
) {
  try {
    const result = await prisma.$transaction(
      async (tx) => {
        const existingLike = await tx.like.findFirst({
          where: { userId: currentUserId, postId: postId },
        });

        const currentlyLiked = !!existingLike;
        let targetLikeState: boolean;

        if (shouldLike !== undefined) {
          targetLikeState = shouldLike;
        } else {
          targetLikeState = !currentlyLiked;
        }

        if (currentlyLiked === targetLikeState) {
          const allLikes = await tx.like.findMany({
            where: { postId },
            select: { userId: true },
          });
          return {
            isLiked: currentlyLiked,
            likeUserIds: allLikes.map((l) => l.userId),
            likeCount: allLikes.length,
          };
        }

        if (targetLikeState) {
          await tx.like.upsert({
            where: {
              userId_postId: { userId: currentUserId, postId: postId },
            },
            create: { userId: currentUserId, postId: postId },
            update: {},
          });
        } else {
          if (existingLike) {
            await tx.like.delete({ where: { id: existingLike.id } });
          }
        }

        const finalLikes = await tx.like.findMany({
          where: { postId },
          select: { userId: true },
        });

        return {
          isLiked: targetLikeState,
          likeUserIds: finalLikes.map((l) => l.userId),
          likeCount: finalLikes.length,
        };
      },
      {
        isolationLevel: "Serializable",
        maxWait: 5000,
        timeout: 10000,
      }
    );

    await Promise.all([
      // @ts-ignore
      revalidateTag("feed-posts"),
      // @ts-ignore
      revalidateTag("profile-posts"),
      // @ts-ignore
      revalidateTag(`post-${postId}`),
      revalidatePath("/", "layout"),
    ]);

    return { success: true, ...result };
  } catch (err: any) {
    console.error("Like operation error:", err);
    if (err.code === "P2034") {
      return {
        success: false,
        error: "Conflict, try again",
        likeUserIds: [],
        likeCount: 0,
      };
    }
    return {
      success: false,
      error: "Database error",
      likeUserIds: [],
      likeCount: 0,
      isLiked: false,
    };
  }
}

export const getLikeStatuses = async (postIds: number[]) => {
  const user = await currentUser();
  if (!user?.id) return {};

  try {
    const likes = await prisma.like.findMany({
      where: {
        userId: user.id,
        postId: { in: postIds },
      },
      select: { postId: true },
    });

    return likes.reduce((acc, like) => {
      if (like.postId !== null) {
        acc[like.postId] = true;
      }
      return acc;
    }, {} as Record<number, boolean>);
  } catch (error) {
    return {};
  }
};
