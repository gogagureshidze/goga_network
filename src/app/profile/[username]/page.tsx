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

async function ProfilePage({ params }: { params: any }) {
  const loggedInUser = await currentUser();
  const loggedInUserId = loggedInUser?.id;
  const clerkUsername = loggedInUser?.username ?? undefined;

  if (!loggedInUser) {
    redirect("/sign-in");
  }
  if (!loggedInUserId) return notFound();
  const { username } = await params; // ✅ await params

  // ✅ Fetch user + counts in one query
  let user = await prisma.user.findFirst({
    where: { username: username },
    include: {
      _count: { select: { posts: true, followers: true, followings: true } },
    },
  });

  if (!user && clerkUsername) {
    user = await prisma.user.findFirst({
      where: { id: loggedInUserId },
      include: {
        _count: { select: { posts: true, followers: true, followings: true } },
      },
    });
  }
  if (!user) return notFound();

  const isOwner = user.id === loggedInUserId;

  // ✅ Sync Clerk username with DB
  if (isOwner && clerkUsername && user.username !== clerkUsername) {
    await prisma.user.update({
      where: { id: user.id },
      data: { username: clerkUsername },
    });
    if (params.username !== clerkUsername) {
      redirect(`/profile/${clerkUsername}`);
    }
  }

  // ✅ Run relational checks in parallel (faster)
  const [isFollowing, isFollowingSent, isBlockedByViewer, isBlockedByUser] =
    await Promise.all([
      prisma.follower.count({
        where: { followerId: loggedInUserId, followingId: user.id },
      }),
      prisma.followRequest.count({
        where: { senderId: loggedInUserId, receiverId: user.id },
      }),
      prisma.block.count({
        where: { blockerId: loggedInUserId, blockedId: user.id },
      }),
      prisma.block.count({
        where: { blockerId: user.id, blockedId: loggedInUserId },
      }),
    ]);

  if (isBlockedByUser) return notFound();

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
              priority={isOwner} // only priority for your own profile
              sizes="100vw"
            />
            <div className="absolute bottom-[-3rem] left-1/2 transform -translate-x-1/2 z-10">
              <Image
                src={user.avatar || "/noAvatar.png"}
                alt="Avatar"
                width={160}
                height={160}
                className="rounded-full ring-2 ring-white object-cover aspect-square"
                sizes="160px"
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

          {/* 👇 Mobile Interaction Section */}
          {!isOwner && (
            <div className="px-4 lg:hidden">
              <UserInfoCardInteraction
                formatedDate={formatedDate}
                isUserBlocked={!!isBlockedByViewer}
                isFollowing={!!isFollowing}
                isFollowingSent={!!isFollowingSent}
                userId={user.id}
                currentUserId={loggedInUserId}
              />
            </div>
          )}

          {/* 👇 Mobile Bio Section */}
          <div className="px-4 lg:hidden">
            <UserInfoCard
              user={user}
              username={user.username!}
              isOwner={isOwner}
              isFollowing={!!isFollowing}
              isFollowingSent={!!isFollowingSent}
              isBlockedByViewer={!!isBlockedByViewer}
              hideInteraction
            />
          </div>

          {/* Feed */}
          <Feed username={user.username ?? undefined} />
        </div>
      </div>

      {/* Right sidebar (desktop only) */}
      <div className="hidden lg:block w-[30%]">
        <RightMenu>
          <UserInfoCard
            user={user}
            username={user.username!}
            isOwner={isOwner}
            isFollowing={!!isFollowing}
            isFollowingSent={!!isFollowingSent}
            isBlockedByViewer={!!isBlockedByViewer}
          />
          <UserMediaCard user={user} username={user.username!} />
        </RightMenu>
      </div>
    </div>
  );
}

export default ProfilePage;
