// lib/actions.ts
"use server";
import prisma from "@/lib/client";
import { currentUser } from "@clerk/nextjs/server";
import { assertCanViewPost, assertCanViewUserContent, visiblePostWhere } from "@/lib/social-access";

const postSelectFields = {
  id: true,
  desc: true,
  createdAt: true,
  userId: true,
  user: {
    select: {
      id: true,
      username: true,
      avatar: true,
      name: true,
      surname: true,
      isPrivate: true,
      lastActiveAt: true,
      showActivityStatus: true,
    },
  },
  media: {
    select: {
      id: true,
      url: true,
      safeUrl: true,
      type: true,
    },
  },
  event: {
    select: {
      id: true,
      date: true,
      endDate: true,
      location: true,
      latitude: true,
      longitude: true,
    },
  },
  poll: {
    select: {
      id: true,
      expiresAt: true,
      options: {
        select: {
          id: true,
          text: true,
          _count: {
            select: {
              votes: true,
            },
          },
          votes: {
            select: {
              userId: true,
              user: {
                select: {
                  username: true,
                  avatar: true,
                },
              },
            },
          },
        },
        orderBy: {
          id: "asc" as const,
        },
      },
    },
  },
  tags: {
    where: {
      deleted: false,
    },
    include: {
      user: {
        select: {
          username: true,
        },
      },
    },
  },
  _count: {
    select: {
      likes: true,
      comments: true,
      shares: true
    },
  },
  likes: {
    select: { userId: true },
  },
  shares: {
    select: { userId: true },
  }
};

const POSTS_PER_PAGE = 10;

function respectActivityPrivacy<T extends { user: { showActivityStatus: boolean; lastActiveAt: Date } }>(post: T) {
  return { ...post, user: { ...post.user, lastActiveAt: post.user.showActivityStatus ? post.user.lastActiveAt : null } };
}

export async function fetchPosts({
  page,
  username,
}: {
  page: number;
  username?: string;
}) {
  const user = await currentUser();
  if (!user) return [];
  if (!Number.isSafeInteger(page) || page < 1 || page > 10000) return [];

  const currentUserId = user.id;

  try {
    const skipAmount = (page - 1) * POSTS_PER_PAGE;

    // --- Profile Page Feed ---
    if (username) {
      const profile = await prisma.user.findFirst({ where: { username }, select: { id: true } });
      if (!profile) return [];
      await assertCanViewUserContent(currentUserId, profile.id);
      const posts = await prisma.post.findMany({
        where: {
          ...visiblePostWhere(currentUserId),
          OR: [
            { user: { is: { username } } },
            { tags: { some: { user: { is: { username } }, deleted: false } } },
          ],
        },
        select: postSelectFields,
        orderBy: { createdAt: "desc" },
        take: POSTS_PER_PAGE,
        skip: skipAmount,
      });

      return posts.filter(
        (post) => post.user.username === username || post.tags?.length > 0
      ).map(respectActivityPrivacy);
    }

    // --- Main User Feed (FIXED) ---
    const posts = await prisma.post.findMany({
      where: {
        ...visiblePostWhere(currentUserId),
        userId: { not: currentUserId },
      },
      select: postSelectFields,
      orderBy: { createdAt: "desc" },
      take: POSTS_PER_PAGE,
      skip: skipAmount,
    });

    return posts.map(respectActivityPrivacy);
  } catch (error) {
    console.error("Error fetching posts:", error);
    return [];
  }
}

export async function fetchSinglePost(postId: number) {
  const user = await currentUser();
  if (!user) return null;

  try {
    await assertCanViewPost(user.id, postId);
    // Force fresh data by using a direct query without cache
    const post = await prisma.post.findUnique({
      where: { id: postId },
      select: postSelectFields,
    });

    return post ? respectActivityPrivacy(post) : null;
  } catch (error) {
    console.error("Error fetching single post:", error);
    return null;
  }
}
