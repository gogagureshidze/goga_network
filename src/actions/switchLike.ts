"use server";

import prisma from "@/lib/client";
import { currentUser } from "@clerk/nextjs/server";
import { revalidatePath, revalidateTag } from "next/cache";
import webpush from "web-push";

// 1. Configure Web Push with logging
console.log("🔑 Initializing VAPID configuration...");
console.log(
  "🔑 Public Key exists:",
  !!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
);
console.log("🔑 Private Key exists:", !!process.env.VAPID_PRIVATE_KEY);
console.log("🔑 Subject:", process.env.VAPID_SUBJECT);

if (process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || "mailto:noreply@goganetwork.com",
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
  console.log("✅ VAPID configured successfully");
} else {
  console.error("❌ VAPID keys are missing! Notifications will not work.");
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

    // Trigger push notification
    if (result.success && result.isLiked) {
      const likerName = user.username || user.firstName || "Someone";

      console.log("❤️ Like successful, triggering notification...");
      console.log("❤️ Liker:", likerName, "Post:", postId);

      // Fire and forget (don't await) so the UI stays fast
      sendLikeNotification(currentUserId, likerName, postId).catch((err) =>
        console.error("❌ Background notification failed:", err)
      );
    }

    return result;
  } finally {
    likeLocks.delete(lockKey);
  }
};

/**
 * Helper to send the notification with detailed logging
 */
async function sendLikeNotification(
  likerId: string,
  likerName: string,
  postId: number
) {
  console.log("\n🔔 ========== NOTIFICATION FLOW START ==========");
  console.log("🔔 Liker ID:", likerId);
  console.log("🔔 Liker Name:", likerName);
  console.log("🔔 Post ID:", postId);

  try {
    // A. Find the post to get the author's ID
    console.log("🔔 Step 1: Finding post in database...");
    const post = await prisma.post.findUnique({
      where: { id: postId },
      select: {
        userId: true, // IMPORTANT: Change to 'authorId' if your schema uses that
        // If you get an error here, check your schema.prisma Post model
      },
    });

    console.log("🔔 Post found:", post ? "YES" : "NO");
    if (post) {
      console.log("🔔 Post author ID:", post.userId);
    }

    // B. Stop if post missing or user liked their own post
    if (!post) {
      console.log("❌ Post not found! Notification cancelled.");
      return;
    }

    if (post.userId === likerId) {
      console.log("ℹ️ User liked their own post. No notification needed.");
      return;
    }

    // C. Get author's subscriptions
    console.log("🔔 Step 2: Getting subscriptions for user:", post.userId);
    const subscriptions = await prisma.pushSubscription.findMany({
      where: { userId: post.userId },
    });

    console.log("🔔 Subscriptions found:", subscriptions.length);

    if (subscriptions.length === 0) {
      console.log("ℹ️ User has not enabled notifications. Skipping.");
      return;
    }

    // Log subscription details (first 50 chars of endpoint for privacy)
    subscriptions.forEach((sub, idx) => {
      console.log(`🔔 Subscription ${idx + 1}:`, {
        id: sub.id,
        endpoint: sub.endpoint.substring(0, 50) + "...",
        createdAt: sub.createdAt,
      });
    });

    // D. Prepare payload
    const payload = JSON.stringify({
      title: "New Like",
      body: `${likerName} liked your post!`,
      url: `/post/${postId}`,
      icon: "/icons/icon-192x192.png",
      badge: "/icons/icon-96x96.png",
    });

    console.log("🔔 Step 3: Prepared payload:", payload);

    // E. Send to all user's devices
    console.log(
      "🔔 Step 4: Sending notifications to",
      subscriptions.length,
      "device(s)..."
    );

    const notifications = subscriptions.map((sub, index) => {
      console.log(`📤 Sending to device ${index + 1}...`);

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
            {
      TTL: 60, // Keep message alive for 60 seconds if device is offline
      headers: {
        "Urgency": "high", // 🔴 REQUIRED for iOS to wake up in background
      },
          }
        )
        .then(() => {
          console.log(
            `✅ Device ${index + 1}: Notification sent successfully!`
          );
        })
        .catch(async (err) => {
          console.error(`❌ Device ${index + 1}: Failed to send`);
          console.error("Error details:", {
            statusCode: err.statusCode,
            body: err.body,
            message: err.message,
          });

          // Cleanup invalid subscriptions
          if (err.statusCode === 410 || err.statusCode === 404) {
            console.log(`🗑️ Removing stale subscription ${sub.id}`);
            await prisma.pushSubscription.delete({ where: { id: sub.id } });
          }
        });
    });

    await Promise.all(notifications);
    console.log("🔔 ========== NOTIFICATION FLOW END ==========\n");
  } catch (error) {
    console.error("❌ ========== NOTIFICATION FLOW ERROR ==========");
    console.error("Fatal error in notification flow:", error);
    console.error(
      "Stack trace:",
      error instanceof Error ? error.stack : "No stack trace"
    );
    console.error("=================================================\n");
  }
}

// TEST FUNCTION - Remove after debugging
export const testNotification = async () => {
  console.log("\n🧪 ========== MANUAL TEST START ==========");

  const user = await currentUser();
  if (!user?.id) {
    console.log("❌ User not authenticated");
    return { error: "Not authenticated" };
  }

  console.log("🧪 Testing for user:", user.id);

  const subscriptions = await prisma.pushSubscription.findMany({
    where: { userId: user.id },
  });

  console.log("🧪 Found subscriptions:", subscriptions.length);

  if (subscriptions.length === 0) {
    console.log("❌ No subscriptions found for this user");
    return { error: "No subscriptions found. Enable notifications first!" };
  }

  const payload = JSON.stringify({
    title: "🧪 Test Notification",
    body: "If you see this, notifications are working!",
    url: "/",
    icon: "/icons/icon-192x192.png",
  });

  try {
    console.log("🧪 Sending test notification...");
    await webpush.sendNotification(
      {
        endpoint: subscriptions[0].endpoint,
        keys: {
          p256dh: subscriptions[0].p256dh,
          auth: subscriptions[0].auth,
        },
      },
      payload
    );

    console.log("✅ Test notification sent successfully!");
    console.log("🧪 ========== MANUAL TEST END ==========\n");
    return { success: true, message: "Test notification sent!" };
  } catch (error: any) {
    console.error("❌ Test failed:", error);
    console.log("🧪 ========== MANUAL TEST END ==========\n");
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
