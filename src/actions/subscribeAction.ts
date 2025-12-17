"use server";

import prisma from "@/lib/client";
import { currentUser } from "@clerk/nextjs/server";

export async function subscribeUser(sub: any) {
  const user = await currentUser();
  if (!user) return { success: false, error: "Not authenticated" };

  try {
    await prisma.pushSubscription.create({
      data: {
        userId: user.id,
        endpoint: sub.endpoint,
        p256dh: sub.keys.p256dh,
        auth: sub.keys.auth,
      },
    });
    return { success: true };
  } catch (error) {
    // If it's a duplicate endpoint, we can ignore it
    return { success: true };
  }
}
