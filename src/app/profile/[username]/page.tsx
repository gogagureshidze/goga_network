import Feed from "@/components/Feed";
import LeftMenu from "@/components/LeftMenu";
import RightMenu from "@/components/RightMenu";
import UserInfoCard from "@/components/UserInfoCard";
import UserMediaCard from "@/components/UserMediaCard";
import UserInfoCardInteraction from "@/components/UserInfoCardInteraction";
import prisma from "@/lib/client";
import { currentUser } from "@clerk/nextjs/server";
import Image from "next/image";
import { notFound, redirect } from "next/navigation";
import { unstable_cache } from "next/cache";

// Cache user data for 10 minutes with minimal fields
const getCachedUser = unstable_cache(
  async (username: string) => {
    return await prisma.user.findFirst({
      where: { username },
      select: {
        id: true,
        username: true,
        avatar: true,
        cover: true,
        name: true,
        surname: true,
        description: true,
        city: true,
        school: true,
        work: true,
        website: true,
        createdAt: true,
        _count: {
          select: {
            posts: true,
            followers: true,
            followings: true,
          },
        },
      },
    });
  },
  ["user-profile"],
  { revalidate: 600, tags: ["user-profile"] }
);

// Cache relationships for 1 minute using findFirst instead of count
const getCachedRelationships = unstable_cache(
  async (loggedInUserId: string, targetUserId: string) => {
    const [isFollowing, isFollowingSent, isBlockedByViewer, isBlockedByUser] =
      await Promise.all([
        prisma.follower.findFirst({
          where: { followerId: loggedInUserId, followingId: targetUserId },
          select: { id: true },
        }),
        prisma.followRequest.findFirst({
          where: { senderId: loggedInUserId, receiverId: targetUserId },
          select: { id: true },
        }),
        prisma.block.findFirst({
          where: { blockerId: loggedInUserId, blockedId: targetUserId },
          select: { id: true },
        }),
        prisma.block.findFirst({
          where: { blockerId: targetUserId, blockedId: loggedInUserId },
          select: { id: true },
        }),
      ]);

    return {
      isFollowing: !!isFollowing,
      isFollowingSent: !!isFollowingSent,
      isBlockedByViewer: !!isBlockedByViewer,
      isBlockedByUser: !!isBlockedByUser,
    };
  },
  ["user-relationships"],
  { revalidate: 60, tags: ["user-relationships"] }
);

async function ProfilePage({ params }: { params: any }) {
  const loggedInUser = await currentUser();
  const loggedInUserId = loggedInUser?.id;
  const clerkUsername = loggedInUser?.username ?? undefined;

  if (!loggedInUser || !loggedInUserId) {
    redirect("/sign-in");
  }

  const { username } = await params;

  // Get user from cache first
  let user = await getCachedUser(username);

  // Fallback to logged-in user if profile not found
  if (!user && clerkUsername) {
    user = await prisma.user.findFirst({
      where: { id: loggedInUserId },
      select: {
        id: true,
        username: true,
        avatar: true,
        cover: true,
        name: true,
        surname: true,
        description: true,
        city: true,
        school: true,
        work: true,
        website: true,
        createdAt: true,
        _count: {
          select: {
            posts: true,
            followers: true,
            followings: true,
          },
        },
      },
    });
  }

  if (!user) return notFound();

  const isOwner = user.id === loggedInUserId;

  // Handle username sync (non-blocking background update)
  if (isOwner && clerkUsername && user.username !== clerkUsername) {
    prisma.user
      .update({
        where: { id: user.id },
        data: { username: clerkUsername },
      })
      .catch(() => {}); // Silent fail

    if (params.username !== clerkUsername) {
      redirect(`/profile/${clerkUsername}`);
    }
  }

  // Get relationships only if not owner
  let relationships = {
    isFollowing: false,
    isFollowingSent: false,
    isBlockedByViewer: false,
    isBlockedByUser: false,
  };

  if (!isOwner) {
    relationships = await getCachedRelationships(loggedInUserId, user.id);

    if (relationships.isBlockedByUser) {
      return notFound();
    }
  }

  const formatedDate = new Date(user.createdAt).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
  });

  return (
    <div className="flex gap-6 pt-6">
      {/* Left sidebar (desktop only) */}
      <div className="hidden xl:block w-[20%]">
        <LeftMenu type="profile" />
      </div>

      {/* Center content */}
      <div className="w-full lg:w-[60%] xl:w-[50%]">
        <div className="flex flex-col gap-6">
          {/* Banner + Avatar */}
          <div className="relative w-full h-64">
            <Image
              src={user.cover || "/noCover.png"}
              alt="Banner"
              fill
              className="object-cover rounded-lg"
              priority={isOwner}
              sizes="(max-width: 1024px) 100vw, 50vw"
            />
            <div className="absolute bottom-[-3rem] left-1/2 transform -translate-x-1/2 z-10">
              <Image
                src={user.avatar || "/noAvatar.png"}
                alt="Avatar"
                width={160}
                height={160}
                className="rounded-full ring-2 ring-white object-cover aspect-square"
                sizes="160px"
                priority={isOwner}
              />
            </div>
          </div>

          {/* Name */}
          <h1 className="text-center text-2xl font-medium mt-[45px]">
            {user.name && user.surname
              ? `${user.name} ${user.surname}`
              : user.username}
          </h1>

          {/* Stats */}
          <div className="flex items-center justify-center gap-12 mb-4">
            {[
              { label: "Posts", count: user._count.posts },
              { label: "Followers", count: user._count.followers },
              { label: "Following", count: user._count.followings },
            ].map((stat) => (
              <div key={stat.label} className="flex flex-col items-center">
                <span className="font-medium text-orange-400">
                  {stat.count}
                </span>
                <span className="text-sm">{stat.label}</span>
              </div>
            ))}
          </div>

          {/* Mobile Interaction Section */}
          {!isOwner && (
            <div className="px-4 lg:hidden">
              <UserInfoCardInteraction
                formatedDate={formatedDate}
                isUserBlocked={relationships.isBlockedByViewer}
                isFollowing={relationships.isFollowing}
                isFollowingSent={relationships.isFollowingSent}
                userId={user.id}
                currentUserId={loggedInUserId}
              />
            </div>
          )}

          {/* Mobile Bio Section */}
          <div className="px-4 lg:hidden">
            <UserInfoCard
              user={user}
              username={user.username!}
              isOwner={isOwner}
              isFollowing={relationships.isFollowing}
              isFollowingSent={relationships.isFollowingSent}
              isBlockedByViewer={relationships.isBlockedByViewer}
              hideInteraction
            />
          </div>

          {/* Feed */}
          <Feed username={user.username ?? undefined} userId={user.id} />
        </div>
      </div>

      {/* Right sidebar (desktop only) */}
      <div className="hidden lg:block w-[30%]">
        <RightMenu>
          <UserInfoCard
            user={user}
            username={user.username!}
            isOwner={isOwner}
            isFollowing={relationships.isFollowing}
            isFollowingSent={relationships.isFollowingSent}
            isBlockedByViewer={relationships.isBlockedByViewer}
          />
          <UserMediaCard user={user} username={user.username!} />
        </RightMenu>
      </div>
    </div>
  );
}

export default ProfilePage;
