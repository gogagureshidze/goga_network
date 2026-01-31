"use server";

import prisma from "@/lib/client";
import { currentUser } from "@clerk/nextjs/server";

interface PushSubscriptionJSON {
  endpoint: string;
  expirationTime?: number | null;
  keys: {
    p256dh: string;
    auth: string;
  };
}

export async function subscribeUser(subscription: PushSubscriptionJSON) {
  try {
    const user = await currentUser();

    if (!user?.id) {
      return { success: false, error: "User not authenticated" };
    }

    console.log(`💾 Saving subscription for user: ${user.id}`);

    // Check if this exact endpoint already exists
    const existingSubscription = await prisma.pushSubscription.findFirst({
      where: {
        endpoint: subscription.endpoint,
      },
    });

    if (existingSubscription) {
      // Update existing subscription
      await prisma.pushSubscription.update({
        where: { id: existingSubscription.id },
        data: {
          userId: user.id,
          p256dh: subscription.keys.p256dh,
          auth: subscription.keys.auth,
        },
      });

      console.log("✅ Subscription updated");
      return { success: true, message: "Subscription updated" };
    }

    // Create new subscription - store endpoint, p256dh, and auth separately
    await prisma.pushSubscription.create({
      data: {
        userId: user.id,
        endpoint: subscription.endpoint, // Store endpoint URL as-is
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
      },
    });

    console.log("✅ Subscription created");
    return { success: true, message: "Subscription created" };
  } catch (error) {
    console.error("❌ Error saving subscription:", error);
    return { success: false, error: "Failed to save subscription" };
  }
}

export async function removeSubscription() {
  try {
    const user = await currentUser();

    if (!user?.id) {
      return { success: false, error: "User not authenticated" };
    }

    await prisma.pushSubscription.deleteMany({
      where: {
        userId: user.id,
      },
    });

    console.log("✅ All subscriptions removed for user");
    return { success: true, message: "Unsubscribed successfully" };
  } catch (error) {
    console.error("❌ Error removing subscription:", error);
    return { success: false, error: "Failed to unsubscribe" };
  }
}

export async function getSubscriptionStatus() {
  try {
    const user = await currentUser();

    if (!user?.id) {
      return { isSubscribed: false };
    }

    const count = await prisma.pushSubscription.count({
      where: { userId: user.id },
    });

    return { isSubscribed: count > 0 };
  } catch (error) {
    console.error("❌ Error checking subscription status:", error);
    return { isSubscribed: false };
  }
}
