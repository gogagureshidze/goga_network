// components/Feed.tsx
import { currentUser } from "@clerk/nextjs/server";
import prisma from "@/lib/client";
import PostList from "./Observer"; // <-- Import the new client component
import { fetchPosts } from "../actions/loadActions"; // <-- Import the new server action
// We also need this for the private profile check

// ⛔ postSelectFields, getCachedBlockedUsers, getCachedFollowing,
// getCachedProfilePosts, and getCachedFeedPosts are all
// REMOVED from this file. Their logic is now in lib/actions.ts

// 🆕 Helper to check if viewer can see profile (This logic stays)
async function canViewProfile(
  viewerId: string,
  profileUserId: string,
  profileUsername: string
) {
  // Get the profile user's privacy status
  const profileUser = await prisma.user.findFirst({
    where: { username: profileUsername },
    select: { isPrivate: true },
  });

  // If not private, everyone can see
  if (!profileUser?.isPrivate) return true;

  // If viewing own profile, can see
  if (viewerId === profileUserId) return true;

  // Check if viewer follows the private account
  const isFollowing = await prisma.follower.findFirst({
    where: {
      followerId: viewerId,
      followingId: profileUserId,
    },
  });

  return !!isFollowing;
}

async function Feed({
  username,
  userId,
}: {
  username?: string;
  userId?: string;
}) {
  const user = await currentUser();
  const currentUserId = user?.id;

  if (!currentUserId) {
    return (
      <div className="bg-rose-50 shadow-md rounded-lg flex flex-col gap-8 p-4">
        <p className="text-center text-gray-500">
          Please log in to see your feed.
        </p>
      </div>
    );
  }

  try {
    let posts: any[] = [];

    if (username) {
      // --- Profile View Logic ---
      const profileUser = await prisma.user.findFirst({
        where: { username },
        select: { id: true, isPrivate: true },
      });

      if (!profileUser) {
        return (
          <div className="bg-rose-50 shadow-md rounded-lg flex flex-col gap-8 p-4">
            <p className="text-center text-gray-500">User not found.</p>
          </div>
        );
      }

      // Check if it's a private account and viewer doesn't follow
      if (profileUser.isPrivate && profileUser.id !== currentUserId) {
        const canView = await canViewProfile(
          currentUserId,
          profileUser.id,
          username
        );

        if (!canView) {
          // 🆕 Show private account message
          return (
            <div className="bg-white shadow-md rounded-lg flex flex-col dark:bg-gray-800 items-center gap-4 p-12 transition-colors duration-300">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-orange-100 to-rose-100 dark:bg-gray-700 flex items-center justify-center transition-colors duration-300">
                <svg
                  className="w-10 h-10 text-orange-500 dark:text-gray-400 transition-colors duration-300"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                  />
                </svg>
              </div>
              <div className="text-center">
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2 transition-colors duration-300">
                  This Account is Private
                </h3>
                <p className="text-gray-600 dark:text-gray-400 max-w-sm transition-colors duration-300">
                  Follow this account to see their photos and videos. ✨
                </p>
              </div>
            </div>
          );
        }
      }
    }

    // --- ⬇️ SIMPLIFIED FETCHING ⬇️ ---
    // Fetch ONLY page 1 for the initial server render
    const initialPosts = await fetchPosts({ page: 1, username });

    // Check if there are likely more posts (page size is 10)
    const hasMorePosts = initialPosts.length >= 10;

    // ⛔ REMOVE the 'Simple scoring' block.
    // All sorting should be done in the database (`orderBy`)
    // for pagination to work correctly.

    return (
      <div className="bg-rose-50 dark:bg-gray-900 shadow-md rounded-lg flex flex-col gap-8 p-4">
        {/* ⬇️ Render the client component ⬇️ */}
        <PostList
          initialPosts={initialPosts}
          username={username}
          hasMorePosts={hasMorePosts}
        />
      </div>
    );
  } catch (error) {
    console.error("Feed error:", error);
    return (
      <div className="bg-rose-50 shadow-md rounded-lg flex flex-col gap-8 p-4">
        <div className="text-center py-8">
          <p className="text-gray-500">Something went wrong.</p>
          <button
            onClick={() => window.location.reload()}
            className="text-blue-500 text-sm mt-2 hover:underline"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }
}

export default Feed;
