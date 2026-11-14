import "server-only";
import { createHash } from "node:crypto";
import { currentUser } from "@clerk/nextjs/server";
import prisma from "@/lib/client";
import { assertLocalDatabase } from "../../server/development-guard";

/** Mirror a real Clerk development account when local webhooks are unavailable.
 * The caller's userId must come from auth(); currentUser verifies it again before
 * any creation. Production continues to use the existing signed webhook. */
export async function ensureLocalDevelopmentUser(userId: string | null) {
  if (process.env.NODE_ENV !== "development" || process.env.GOGA_LOCAL_DEVELOPMENT !== "true" || !userId) return;
  assertLocalDatabase(process.env);
  if (!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.startsWith("pk_test_") || !process.env.CLERK_SECRET_KEY?.startsWith("sk_test_")) {
    throw new Error("LOCAL_ACCOUNT_BOOTSTRAP_REQUIRES_DEVELOPMENT_CLERK_KEYS");
  }
  if (await prisma.user.findUnique({ where: { id: userId }, select: { id: true } })) return;
  const profile = await currentUser();
  if (!profile || profile.id !== userId) throw new Error("LOCAL_ACCOUNT_BOOTSTRAP_SESSION_MISMATCH");

  const suffix = createHash("sha256").update(profile.id).digest("hex");
  const preferred = profile.username?.trim().slice(0, 100);
  const candidates = preferred
    ? [preferred, `${preferred}_${suffix.slice(0, 16)}`, `local_${suffix}`]
    : [`local_${suffix.slice(0, 16)}`, `local_${suffix}`];
  let username: string | undefined;
  for (const candidate of candidates) {
    if (!await prisma.user.findFirst({ where: { username: candidate, id: { not: userId } }, select: { id: true } })) {
      username = candidate;
      break;
    }
  }
  if (!username) throw new Error("LOCAL_ACCOUNT_BOOTSTRAP_USERNAME_UNAVAILABLE");
  // A concurrent verified request/webhook may create this ID after the read.
  // Empty update preserves every existing local profile field in that case.
  await prisma.user.upsert({
    where: { id: profile.id },
    create: {
      id: profile.id,
      username,
      name: profile.firstName?.slice(0, 191) || null,
      surname: profile.lastName?.slice(0, 191) || null,
      avatar: profile.imageUrl || "/noAvatar.png",
      cover: "/noCover.png",
    },
    update: {},
    select: { id: true },
  });
}
