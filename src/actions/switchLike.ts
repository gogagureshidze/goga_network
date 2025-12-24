"use server";

import prisma from "@/lib/client";
import { currentUser } from "@clerk/nextjs/server";
import { revalidatePath, revalidateTag } from "next/cache";
import webpush from "web-push";

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

    // Trigger push notification
    if (result.success && result.isLiked) {
      const likerName = user.username || user.firstName || "Someone";

      console.log("❤️ Like successful. Starting notification process...");

      // 🚨 CRITICAL FIX: We use 'await' here.
      // If we don't await, Next.js kills the server process immediately.
      try {
        await sendLikeNotification(currentUserId, likerName, postId);
      } catch (err) {
        console.error("❌ Notification failed (non-blocking error):", err);
      }
    }

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
  console.log("\n🔔 ========== NOTIFICATION FLOW START ==========");

  // 1. Configure VAPID inside the function to ensure env vars are loaded
  if (
    !process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ||
    !process.env.VAPID_PRIVATE_KEY
  ) {
    console.error("❌ VAPID Keys are missing in .env file");
    return;
  }

  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || "mailto:noreply@goganetwork.com",
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );

  try {
    // 2. Find the post to get the author's ID
    const post = await prisma.post.findUnique({
      where: { id: postId },
      select: { userId: true },
    });

    if (!post) {
      console.log("❌ Post not found! Notification cancelled.");
      return;
    }

    // 3. Stop if user liked their own post
    if (post.userId === likerId) {
      console.log("ℹ️ User liked their own post. No notification needed.");
      return;
    }

    // 4. Get author's subscriptions
    const subscriptions = await prisma.pushSubscription.findMany({
      where: { userId: post.userId },
    });

    console.log(`🔔 Found ${subscriptions.length} subscription(s) for author.`);

    if (subscriptions.length === 0) {
      console.log("ℹ️ User has not enabled notifications. Skipping.");
      return;
    }

    // 5. Prepare payload
    const payload = JSON.stringify({
      title: "New Like",
      body: `${likerName} liked your post!`,
      url: `/post/${postId}`,
      icon: "/icons/icon-192x192.png",
      badge: "/icons/icon-96x96.png",
    });

    // 6. Send to all user's devices with iOS HEADERS
    const notifications = subscriptions.map((sub, index) => {
      return webpush
        .sendNotification(
          {
            endpoint: sub.endpoint,
            keys: {
              p256dh: sub.p256dh,
              auth: sub.auth,
            },
          },
          payload,
          // 🚨 CRITICAL FIX: Headers for iOS
          {
            TTL: 60, // Message lives for 60 seconds
            headers: {
              Urgency: "high", // 🔴 REQUIRED for iPhone to wake up
            },
          }
        )
        .then(() => {
          console.log(`✅ Device ${index + 1}: Notification sent!`);
        })
        .catch(async (err) => {
          console.error(`❌ Device ${index + 1} Failed: ${err.statusCode}`);

          // Cleanup invalid subscriptions (410 = Gone, 404 = Not Found)
          if (err.statusCode === 410 || err.statusCode === 404) {
            console.log(`🗑️ Removing stale subscription ${sub.id}`);
            await prisma.pushSubscription.delete({ where: { id: sub.id } });
          }
        });
    });

    // Wait for all notifications to attempt sending
    await Promise.all(notifications);
    console.log("🔔 ========== NOTIFICATION FLOW END ==========\n");
  } catch (error) {
    console.error("❌ ========== NOTIFICATION FLOW ERROR ==========");
    console.error(error);
  }
}

// TEST FUNCTION - Remove after debugging
export const testNotification = async () => {
  console.log("\n🧪 ========== MANUAL TEST START ==========");

  const user = await currentUser();
  if (!user?.id) {
    return { error: "Not authenticated" };
  }

  // Configure VAPID for test function too
  if (
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY &&
    process.env.VAPID_PRIVATE_KEY
  ) {
    webpush.setVapidDetails(
      process.env.VAPID_SUBJECT || "mailto:noreply@goganetwork.com",
      process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
      process.env.VAPID_PRIVATE_KEY
    );
  }

  const subscriptions = await prisma.pushSubscription.findMany({
    where: { userId: user.id },
  });

  if (subscriptions.length === 0) {
    return { error: "No subscriptions found. Enable notifications first!" };
  }

  const payload = JSON.stringify({
    title: "🧪 Test Notification",
    body: "If you see this, notifications are working!",
    url: "/",
    icon: "/icons/icon-192x192.png",
  });

  try {
    await webpush.sendNotification(
      {
        endpoint: subscriptions[0].endpoint,
        keys: {
          p256dh: subscriptions[0].p256dh,
          auth: subscriptions[0].auth,
        },
      },
      payload,
      // 🚨 ALSO ADD HEADERS HERE FOR TESTING
      {
        TTL: 60,
        headers: {
          Urgency: "high",
        },
      }
    );

    console.log("✅ Test notification sent successfully!");
    return { success: true, message: "Test notification sent!" };
  } catch (error: any) {
    console.error("❌ Test failed:", error);
    return { error: error.message, details: error.body };
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
