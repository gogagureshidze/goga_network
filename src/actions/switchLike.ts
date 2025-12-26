"use server";

import prisma from "@/lib/client";
import { currentUser } from "@clerk/nextjs/server";
import { revalidatePath, revalidateTag } from "next/cache";
import webpush from "web-push";

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
  console.log("✅ VAPID configured successfully");
} else {
  console.error("❌ Missing VAPID configuration in environment variables");
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

  // Wait for existing lock if user is spamming the button
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

    // 🔥 CRITICAL: Send notification if like was added
    if (result.success && result.isLiked) {
      const likerName = user.username || user.firstName || "Someone";

      console.log("❤️ Like successful, sending notification...");

      // Send notification without blocking the response
      sendLikeNotification(currentUserId, likerName, postId).catch((err) => {
        console.error("❌ Notification error (non-blocking):", err);
      });
    }

    return result;
  } finally {
    likeLocks.delete(lockKey);
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
  console.log("\n🔔 ========== NOTIFICATION FLOW START ==========");
  console.log(`Liker: ${likerName} (${likerId})`);
  console.log(`Post ID: ${postId}`);

  try {
    // 1. Find the post and its author
    const post = await prisma.post.findUnique({
      where: { id: postId },
      select: { userId: true },
    });

    if (!post) {
      console.log("❌ Post not found");
      return;
    }

    console.log(`📝 Post author: ${post.userId}`);

    // 2. Don't notify if user liked their own post
    if (post.userId === likerId) {
      console.log("ℹ️ User liked their own post, skipping notification");
      return;
    }

    // 3. Get all push subscriptions for the post author
    const subscriptions = await prisma.pushSubscription.findMany({
      where: { userId: post.userId },
    });

    console.log(`📱 Found ${subscriptions.length} subscription(s)`);

    if (subscriptions.length === 0) {
      console.log("ℹ️ No subscriptions found for this user");
      return;
    }

    // 4. Prepare notification payload
    const payload = JSON.stringify({
      title: "New Like ❤️",
      body: `${likerName} liked your post!`,
      url: `/post/${postId}`,
      icon: "/icons/icon-192x192.png",
      badge: "/icons/icon-96x96.png",
      tag: `post-like-${postId}`,
    });

    console.log("📦 Payload:", payload);

    // 5. Send to all devices
    const sendPromises = subscriptions.map(async (sub, index) => {
      console.log(`📤 Sending to device ${index + 1}/${subscriptions.length}`);

      try {
        const result = await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: {
              p256dh: sub.p256dh,
              auth: sub.auth,
            },
          },
          payload,
          {
            TTL: 60,
            urgency: "high", // iOS needs this
            topic: "post-likes",
          }
        );

        console.log(
          `✅ Device ${index + 1}: Sent (Status: ${result.statusCode})`
        );
        return { success: true, index };
      } catch (err: any) {
        console.error(`❌ Device ${index + 1}: Failed`);
        console.error(`   Error: ${err.message}`);
        console.error(`   Status: ${err.statusCode}`);
        console.error(`   Body: ${err.body}`);

        // Remove invalid subscriptions (410 = Gone, 404 = Not Found)
        if (err.statusCode === 410 || err.statusCode === 404) {
          console.log(`🗑️ Removing stale subscription ${sub.id}`);
          await prisma.pushSubscription
            .delete({
              where: { id: sub.id },
            })
            .catch((e) => console.error("Failed to delete subscription:", e));
        }

        return { success: false, index, error: err.message };
      }
    });

    // Wait for all to complete
    const results = await Promise.allSettled(sendPromises);

    const successful = results.filter((r) => r.status === "fulfilled").length;
    console.log(
      `✅ ${successful}/${subscriptions.length} notifications sent successfully`
    );

    console.log("🔔 ========== NOTIFICATION FLOW END ==========\n");
  } catch (error) {
    console.error("❌ ========== NOTIFICATION FLOW ERROR ==========");
    console.error(error);
    console.error(
      "Stack:",
      error instanceof Error ? error.stack : "No stack trace"
    );
  }
}

// 🧪 TEST FUNCTION
export const testNotification = async () => {
  console.log("\n🧪 ========== MANUAL TEST START ==========");

  const user = await currentUser();
  if (!user?.id) {
    return { error: "Not authenticated" };
  }

  console.log(`Testing for user: ${user.id}`);

  const subscriptions = await prisma.pushSubscription.findMany({
    where: { userId: user.id },
  });

  console.log(`Found ${subscriptions.length} subscription(s)`);

  if (subscriptions.length === 0) {
    return { error: "No subscriptions found. Enable notifications first!" };
  }

  const payload = JSON.stringify({
    title: "🧪 Test Notification",
    body: "If you see this, push notifications are working!",
    url: "/",
    icon: "/icons/icon-192x192.png",
    badge: "/icons/icon-96x96.png",
    tag: "test-notification",
  });

  try {
    console.log("📤 Sending test notification...");

    const result = await webpush.sendNotification(
      {
        endpoint: subscriptions[0].endpoint,
        keys: {
          p256dh: subscriptions[0].p256dh,
          auth: subscriptions[0].auth,
        },
      },
      payload,
      {
        TTL: 60,
        urgency: "high",
        topic: "test",
      }
    );

    console.log("✅ Test notification sent!");
    console.log("Status:", result.statusCode);
    return { success: true, message: "Test notification sent!" };
  } catch (error: any) {
    console.error("❌ Test failed:", error);
    return {
      error: error.message,
      details: error.body,
      statusCode: error.statusCode,
    };
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
