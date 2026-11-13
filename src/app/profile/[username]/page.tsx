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
import { loadProfileAccess } from "@/lib/profile-access";
import { Suspense } from "react";
import ActivityStatus from "@/components/ActivityStatus";
import ProfileHighlights from "@/components/ProfileHighlights";
import ProfileStats from "@/components/ProfileStats";

async function ProfilePage({ params }: { params: any }) {
  const startTime = Date.now();

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

  const profile = await loadProfileAccess(loggedInUserId, username, clerkUsername);
  if (!profile) return notFound();
  const { user, isOwner, relationships, canViewContent, visibleLastActiveAt } = profile;
  const loadTime = Date.now() - startTime;

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

  const formatedDate = new Date(user.createdAt).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
  });

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
          {/* Banner + Avatar */}
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

          {/* Name */}
          <h1 className="text-center text-2xl font-medium mt-[45px]">
            {user.name && user.surname
              ? `${user.name} ${user.surname}`
              : user.username}
          </h1>

          {visibleLastActiveAt && (
            <div className="flex justify-center">
              <ActivityStatus
                lastActiveAt={visibleLastActiveAt}
                size="md"
                showText={true}
              />
            </div>
          )}

          {/* Stats — client component handles modal state */}
          <ProfileStats
            postsCount={user._count.posts}
            followersCount={user._count.followers}
            followingsCount={user._count.followings}
            userId={user.id}
            username={user.username!}
            isPrivate={user.isPrivate}
            isOwner={isOwner}
            isFollowing={relationships.isFollowing}
          />

          {canViewContent && <ProfileHighlights userId={user.id} isOwner={isOwner} />}

          {/* Mobile sections */}
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

          {/* Feed */}
          <Suspense
            fallback={
              <div className="flex items-center justify-center p-8">
                <div className="flex flex-col items-center gap-3">
                  <div className="relative w-12 h-12">
                    <div className="absolute inset-0 border-4 border-orange-400 rounded-full"></div>
                    <div className="absolute inset-0 border-4 border-transparent border-t-orange-500 rounded-full animate-spin"></div>
                  </div>
                  <div className="flex gap-1">
                    <div className="w-2 h-2 bg-orange-500 rounded-full animate-bounce"></div>
                    <div
                      className="w-2 h-2 bg-orange-500 rounded-full animate-bounce"
                      style={{ animationDelay: "0.1s" }}
                    ></div>
                    <div
                      className="w-2 h-2 bg-orange-500 rounded-full animate-bounce"
                      style={{ animationDelay: "0.2s" }}
                    ></div>
                  </div>
                </div>
              </div>
            }
          >
            <Feed username={user.username ?? undefined} userId={user.id} />
          </Suspense>
        </div>
      </div>

      {/* Right sidebar */}
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

          {!isOwner && (
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
          )}

          {canViewContent && (
            <Suspense fallback="Loading...">
              <UserMediaCard user={user} username={user.username!} />
            </Suspense>
          )}
        </RightMenu>
      </div>
    </div>
  );
}

export default ProfilePage;
