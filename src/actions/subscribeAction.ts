"use server";

import prisma from "@/lib/client";
import { currentUser } from "@clerk/nextjs/server";
import { validatePushSubscription } from "@/lib/push-policy";

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

    const checked = validatePushSubscription(subscription);
    return await prisma.$transaction(async (tx) => {
      const existing = await tx.pushSubscription.findUnique({ where: { endpoint: checked.endpoint } });
      if (existing) {
        if (existing.userId !== user.id) return { success: false, error: "This subscription is unavailable. Re-enable notifications in this browser." };
        await tx.pushSubscription.update({ where: { id: existing.id, userId: user.id }, data: checked.keys });
        return { success: true, message: "Subscription updated" };
      }
      if (await tx.pushSubscription.count({ where: { userId: user.id } }) >= 20) return { success: false, error: "Too many subscribed devices. Remove old subscriptions first." };
      await tx.pushSubscription.create({ data: { userId: user.id, endpoint: checked.endpoint, ...checked.keys } });
      return { success: true, message: "Subscription created" };
    }, { isolationLevel: "Serializable" });
  } catch (error) {
    console.error("push.subscription_save_failed");
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

    return { success: true, message: "Unsubscribed successfully" };
  } catch (error) {
    console.error("push.subscription_remove_failed");
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
    console.error("push.subscription_status_failed");
    return { isSubscribed: false };
  }
}
