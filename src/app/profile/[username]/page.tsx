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
import { Suspense } from "react";

// Super aggressive caching for user data
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
        bioPattern: true,
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
  { revalidate: 1800, tags: ["user-profile"] } // 30 minutes
);

// Very fast relationship check
const getCachedRelationships = unstable_cache(
  async (loggedInUserId: string, targetUserId: string) => {
    // Timeout after 1 second
    const queryPromise = Promise.all([
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

    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Relationship query timeout")), 1000)
    );

    try {
      const [isFollowing, isFollowingSent, isBlockedByViewer, isBlockedByUser] =
        (await Promise.race([queryPromise, timeoutPromise])) as any;

      return {
        isFollowing: !!isFollowing,
        isFollowingSent: !!isFollowingSent,
        isBlockedByViewer: !!isBlockedByViewer,
        isBlockedByUser: !!isBlockedByUser,
      };
    } catch (error) {
      // Return safe defaults on timeout
      return {
        isFollowing: false,
        isFollowingSent: false,
        isBlockedByViewer: false,
        isBlockedByUser: false,
      };
    }
  },
  ["user-relationships"],
  { revalidate: 300, tags: ["user-relationships"] } // 5 minutes
);

async function ProfilePage({ params }: { params: any }) {
  const startTime = Date.now();

  // Get user immediately, don't await params
  const loggedInUserPromise = currentUser();
  const paramsPromise = params;

  const [loggedInUser, resolvedParams] = await Promise.all([
    loggedInUserPromise,
    paramsPromise,
  ]);

  const loggedInUserId = loggedInUser?.id;
  const clerkUsername = loggedInUser?.username ?? undefined;

  if (!loggedInUser || !loggedInUserId) {
    redirect("/sign-in");
  }

  const { username } = resolvedParams;

  // Fast user lookup with fallback
  let user = await getCachedUser(username);

  if (!user && clerkUsername === username) {
    // Direct query for own profile
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
        bioPattern: true,
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
  const loadTime = Date.now() - startTime;

  // Background username sync - don't block render
  if (isOwner && clerkUsername && user.username !== clerkUsername) {
    prisma.user
      .update({
        where: { id: user.id },
        data: { username: clerkUsername },
      })
      .catch(() => {});

    if (resolvedParams.username !== clerkUsername) {
      redirect(`/profile/${clerkUsername}`);
    }
  }

  // Default relationships - fast path for owner
  let relationships = {
    isFollowing: false,
    isFollowingSent: false,
    isBlockedByViewer: false,
    isBlockedByUser: false,
  };

  // Only check relationships for non-owners
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

  // Log performance in development
  if (process.env.NODE_ENV === "development") {
    console.log(`Profile loaded in ${loadTime}ms`);
  }

  return (
    <div className="flex gap-6 pt-6">
      {/* Left sidebar */}
      <div className="hidden xl:block w-[20%]">
        <LeftMenu type="profile" />
      </div>

      {/* Center content */}
      <div className="w-full lg:w-[60%] xl:w-[50%]">
        <div className="flex flex-col gap-6">
          {/* Critical path - Banner + Avatar with optimized images */}
          <div className="relative w-full h-64">
            <Image
              src={user.cover || "/noCover.png"}
              alt=""
              fill
              className="object-cover rounded-lg"
              priority={true}
              quality={75}
              sizes="(max-width: 768px) 100vw, (max-width: 1024px) 60vw, 50vw"
              placeholder="blur"
              blurDataURL="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAhEAACAQMDBQAAAAAAAAAAAAABAgMABAUGIWGRkqGx0f/EABUBAQEAAAAAAAAAAAAAAAAAAAMF/8QAGhEAAgIDAAAAAAAAAAAAAAAAAAECEgMRkf/aAAwDAQACEQMRAD8AltJagyeH0AthI5xdrLcNM91BF5pX2HaH9bcfaSXWGaRmknyJckliyjqTzSlT54b6bk+h0R//2Q=="
            />
            <div className="absolute bottom-[-3rem] left-1/2 transform -translate-x-1/2 z-10">
              <Image
                src={user.avatar || "/noAvatar.png"}
                alt=""
                width={160}
                height={160}
                className="rounded-full ring-2 ring-white object-cover aspect-square"
                priority={true}
                quality={75}
                placeholder="blur"
                blurDataURL="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAhEAACAQMDBQAAAAAAAAAAAAABAgMABAUGIWGRkqGx0f/EABUBAQEAAAAAAAAAAAAAAAAAAAMF/8QAGhEAAgIDAAAAAAAAAAAAAAAAAAECEgMRkf/aAAwDAQACEQMRAD8AltJagyeH0AthI5xdrLcNM91BF5pX2HaH9bcfaSXWGaRmknyJckliyjqTzSlT54b6bk+h0R//2Q=="
              />
            </div>
          </div>

          {/* Name - immediate render */}
          <h1 className="text-center text-2xl font-medium mt-[45px]">
            {user.name && user.surname
              ? `${user.name} ${user.surname}`
              : user.username}
          </h1>

          {/* Stats - immediate render */}
          <div className="flex items-center justify-center gap-12 mb-4">
            <div className="flex flex-col items-center">
              <span className="font-medium text-orange-400">
                {user._count.posts}
              </span>
              <span className="text-sm">Posts</span>
            </div>
            <div className="flex flex-col items-center">
              <span className="font-medium text-orange-400">
                {user._count.followers}
              </span>
              <span className="text-sm">Followers</span>
            </div>
            <div className="flex flex-col items-center">
              <span className="font-medium text-orange-400">
                {user._count.followings}
              </span>
              <span className="text-sm">Following</span>
            </div>
          </div>

          {/* Mobile sections - non-critical */}
          {!isOwner && (
            <div className="px-4 lg:hidden">
              <Suspense fallback="Loading...">
                <UserInfoCardInteraction
                  formatedDate={formatedDate}
                  isUserBlocked={relationships.isBlockedByViewer}
                  isFollowing={relationships.isFollowing}
                  isFollowingSent={relationships.isFollowingSent}
                  userId={user.id}
                  currentUserId={loggedInUserId}
                  isBlockedByViewer={relationships.isBlockedByViewer}
                />
              </Suspense>
            </div>
          )}

          <div className="px-4 lg:hidden">
            <Suspense fallback="Loading...">
              <UserInfoCard
                user={user}
                username={user.username!}
                isOwner={isOwner}
                isFollowing={relationships.isFollowing}
                isFollowingSent={relationships.isFollowingSent}
                isBlockedByViewer={relationships.isBlockedByViewer}
                hideInteraction
              />
            </Suspense>
          </div>

          {/* Feed - render immediately */}
          <Suspense fallback="Loading...">
            <Feed username={user.username ?? undefined} userId={user.id} />
          </Suspense>
        </div>
      </div>

      {/* Right sidebar - non-critical */}
      <div className="hidden lg:block w-[30%]">
        <RightMenu>
          <Suspense fallback="Loading...">
            <UserInfoCard
              user={user}
              username={user.username!}
              isOwner={isOwner}
              isFollowing={relationships.isFollowing}
              isFollowingSent={relationships.isFollowingSent}
              isBlockedByViewer={relationships.isBlockedByViewer}
            />
          </Suspense>
          <Suspense fallback="Loading...">

          <UserMediaCard user={user} username={user.username!} />
          </Suspense>
        </RightMenu>
      </div>
    </div>
  );
}

export default ProfilePage;
