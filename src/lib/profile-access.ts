import prisma from "@/lib/client";

const profileSelect = {
  id: true, username: true, avatar: true, cover: true, name: true,
  surname: true, description: true, city: true, school: true, work: true,
  website: true, lastActiveAt: true, showActivityStatus: true, createdAt: true,
  bioPattern: true, isPrivate: true, showStoryLikes: true, allowStoryComments: true,
  _count: { select: { posts: true, followers: true, followings: true } },
} as const;

// Profile privacy and relationships are authorization inputs. Read them for each
// request, and propagate database failures instead of granting access by default.
export async function loadProfileAccess(viewerId: string, username: string, clerkUsername?: string) {
  if (!viewerId) throw new Error("Not authenticated");
  let user = await prisma.user.findFirst({ where: { username }, select: profileSelect });
  if (!user && clerkUsername === username) {
    user = await prisma.user.findFirst({ where: { id: viewerId }, select: profileSelect });
  }
  if (!user) return null;

  const isOwner = user.id === viewerId;
  let relationships = {
    isFollowing: false, isFollowingSent: false,
    isBlockedByViewer: false, isBlockedByUser: false,
  };
  if (!isOwner) {
    const [following, request, outgoingBlock, incomingBlock] = await Promise.all([
      prisma.follower.findFirst({ where: { followerId: viewerId, followingId: user.id }, select: { id: true } }),
      prisma.followRequest.findFirst({ where: { senderId: viewerId, receiverId: user.id }, select: { id: true } }),
      prisma.block.findFirst({ where: { blockerId: viewerId, blockedId: user.id }, select: { id: true } }),
      prisma.block.findFirst({ where: { blockerId: user.id, blockedId: viewerId }, select: { id: true } }),
    ]);
    relationships = {
      isFollowing: Boolean(following), isFollowingSent: Boolean(request),
      isBlockedByViewer: Boolean(outgoingBlock), isBlockedByUser: Boolean(incomingBlock),
    };
    if (relationships.isBlockedByUser) return null;
  }

  const blocked = relationships.isBlockedByViewer || relationships.isBlockedByUser;
  return {
    // This object stays within server components. Only the owner receives it in
    // their edit form; other client children receive explicit public fields.
    user, isOwner, relationships,
    canViewContent: !blocked && (isOwner || !user.isPrivate || relationships.isFollowing),
    visibleLastActiveAt: !blocked && user.showActivityStatus ? user.lastActiveAt : null,
  };
}
