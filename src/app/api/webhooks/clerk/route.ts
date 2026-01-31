import { Webhook } from "svix";
import prisma from "@/lib/client";
import { clerkClient } from "@clerk/nextjs/server";

// Prisma needs Node.js, not Edge
export const runtime = "nodejs";
// Avoid route caching
export const dynamic = "force-dynamic";

// Define the expected event types
type ClerkUser = {
  id: string;
};

type SvixEvent = {
  type: string;
  data: ClerkUser;
};

export async function POST(req: Request) {
  const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;
  if (!WEBHOOK_SECRET) {
    return new Response("Missing WEBHOOK_SECRET", { status: 500 });
  }

  // Get headers and verify the raw payload
  const payload = await req.text();
  const svix_id = req.headers.get("svix-id");
  const svix_timestamp = req.headers.get("svix-timestamp");
  const svix_signature = req.headers.get("svix-signature");

  if (!svix_id || !svix_timestamp || !svix_signature) {
    return new Response("Missing svix headers", { status: 400 });
  }

  let evt: SvixEvent;

  try {
    const wh = new Webhook(WEBHOOK_SECRET);
    evt = wh.verify(payload, {
      "svix-id": svix_id,
      "svix-timestamp": svix_timestamp,
      "svix-signature": svix_signature,
    }) as SvixEvent;

  } catch (err) {
    console.error("❌ Webhook verification failed:", err);
    return new Response("Invalid signature", { status: 400 });
  }

  const { type, data } = evt;
  const { id } = data;

  try {

    // This is the key: always fetch the latest user from Clerk
    // to ensure the database is in sync regardless of the webhook payload.
    // This pattern works reliably in your environment.

    if (type === "user.created" || type === "user.updated") {
      const clerk = await clerkClient();
      const clerkUser = await clerk.users.getUser(id);

      // Handle user creation

      if (type === "user.created") {
        await prisma.user.create({
          data: {
            id: clerkUser.id,
            username: clerkUser.username ?? "unknown",
            avatar: clerkUser.imageUrl ?? "/noAvatar.png",
            cover: "/noCover.png",
          },
        });
        return new Response("✅ user.created handled", { status: 200 });
      }

      // Handle user updates
      if (type === "user.updated") {
        // Use upsert to handle both updates and potential creation if a user
        // was missed (very rare, but good practice)
        await prisma.user.upsert({
          where: { id: clerkUser.id },
          create: {
            id: clerkUser.id,
            username: clerkUser.username ?? "unknown",
            avatar: clerkUser.imageUrl ?? "/noAvatar.png",
            cover: "/noCover.png",
          },
          update: {
            username: clerkUser.username ?? undefined,
            avatar: clerkUser.imageUrl ?? undefined,
          },
        });
        return new Response("✅ user.updated handled", { status: 200 });
      }
    }

    // Handle user deletion (no need to fetch from Clerk, as the user is already gone)
    if (type === "user.deleted") {
      await prisma.user.delete({ where: { id } });
      return new Response("✅ user.deleted handled", { status: 200 });
    }

    return new Response("⚠️ event ignored", { status: 200 });
  } catch (err: any) {
    console.error("❌ Prisma error:", err);
    return new Response("Server error", { status: 500 });
  }

}
