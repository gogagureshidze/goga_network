"use server";

import prisma from "@/lib/client";
import { currentUser } from "@clerk/nextjs/server";
import { revalidatePath, revalidateTag } from "next/cache";
import webpush from "web-push";
import { assertCanViewPost } from "@/lib/social-access";
import { allowPushTest, validatePushSubscription } from "@/lib/push-policy";

// Configure VAPID once at module level
if (
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY &&
  process.env.VAPID_PRIVATE_KEY &&
  process.env.VAPID_SUBJECT
) {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT,
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );

} else {
  // Notifications remain unavailable until the existing VAPID configuration is supplied.
}

// In-memory lock to prevent spam-clicking
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
  try {
    await assertCanViewPost(currentUserId, postId);
  } catch {
    return { success: false, error: "Post unavailable", likeUserIds: [], likeCount: 0 };
  }

  // Wait for existing lock if user is spamming the button
  if (likeLocks.has(lockKey)) {
    try {
      await likeLocks.get(lockKey);
    } catch {
      // The next intent can still succeed after a failed prior request.
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

    // 🔥 CRITICAL: Send notification if like was added
    if (result.success && result.isLiked && "changed" in result && result.changed) {
      const likerName = user.username || user.firstName || "Someone";



      // Send notification without blocking the response
      sendLikeNotification(currentUserId, likerName, postId).catch((err) => {
        console.error("push.like_notification_failed");
      });
    }

    return result;
  } finally {
    if (likeLocks.get(lockKey) === operationPromise) likeLocks.delete(lockKey);
  }
};

/**
 * Send push notification to post author
 */
async function sendLikeNotification(
  likerId: string,
  likerName: string,
  postId: number
) {
  try {
    const post = await prisma.post.findUnique({ where: { id: postId }, select: { userId: true } });
    if (!post || post.userId === likerId) return;
    const subscriptions = await prisma.pushSubscription.findMany({ where: { userId: post.userId }, take: 20 });
    const payload = JSON.stringify({ title: "New Like ❤️", body: `${likerName} liked your post!`, url: `/post/${postId}`, icon: "/icons/icon-192x192.png", badge: "/icons/icon-96x96.png", tag: `post-like-${postId}` });
    await Promise.allSettled(subscriptions.map(async (sub) => {
      try {
        const subscription = validatePushSubscription({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } });
        await webpush.sendNotification(subscription, payload, { TTL: 60, urgency: "high", topic: "post-likes", timeout: 10000 });
      } catch (reason) {
        const status = (reason as { statusCode?: number }).statusCode;
        if (status === 410 || status === 404) await prisma.pushSubscription.deleteMany({ where: { id: sub.id, userId: post.userId } });
        console.error("push.delivery_failed", { status: typeof status === "number" ? status : undefined });
      }
    }));
  } catch { console.error("push.like_notification_failed"); }
}

export const testNotification = async () => {
  const user = await currentUser();
  if (!user?.id) return { error: "Not authenticated" };
  if (!allowPushTest(user.id)) return { error: "Please wait 30 seconds before another test." };
  const subscription = await prisma.pushSubscription.findFirst({ where: { userId: user.id } });
  if (!subscription) return { error: "No subscriptions found. Enable notifications first!" };
  try {
    const checked = validatePushSubscription({ endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } });
    await webpush.sendNotification(checked, JSON.stringify({ title: "Test Notification", body: "Push notifications are working!", url: "/", icon: "/icons/icon-192x192.png", tag: "test-notification" }), { TTL: 60, urgency: "high", topic: "test", timeout: 10000 });
    return { success: true, message: "Test notification sent!" };
  } catch {
    console.error("push.test_failed");
    return { error: "Notification delivery failed. Re-enable notifications and try again." };
  }
};

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
            changed: false,
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
          changed: true,
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
    console.error("social.like_failed", { code: typeof err?.code === "string" ? err.code : "UNKNOWN" });
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
