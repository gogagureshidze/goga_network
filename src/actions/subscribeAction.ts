"use server";

import prisma from "@/lib/client";
import { currentUser } from "@clerk/nextjs/server";

interface PushSubscriptionJSON {
  endpoint: string;
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

    // Check if this subscription already exists for this user
    const existingSubscription = await prisma.pushSubscription.findFirst({
      where: {
        userId: user.id,
        endpoint: subscription.endpoint,
      },
    });

    if (existingSubscription) {
      // Update the existing subscription (keys might have changed)
      await prisma.pushSubscription.update({
        where: { id: existingSubscription.id },
        data: {
          p256dh: subscription.keys.p256dh,
          auth: subscription.keys.auth,
        },
      });

      return { success: true, message: "Subscription updated" };
    }

    // Create new subscription
    await prisma.pushSubscription.create({
      data: {
        userId: user.id,
        endpoint: subscription.endpoint,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
      },
    });

    return { success: true, message: "Subscription created" };
  } catch (error) {
    console.error("Error saving subscription:", error);
    return { success: false, error: "Failed to save subscription" };
  }
}

export async function unsubscribeUser(endpoint: string) {
  try {
    const user = await currentUser();

    if (!user?.id) {
      return { success: false, error: "User not authenticated" };
    }

    await prisma.pushSubscription.deleteMany({
      where: {
        userId: user.id,
        endpoint: endpoint,
      },
    });

    return { success: true, message: "Unsubscribed successfully" };
  } catch (error) {
    console.error("Error unsubscribing:", error);
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
    console.error("Error checking subscription status:", error);
    return { isSubscribed: false };
  }
}
