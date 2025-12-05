"use server";

import prisma from "@/lib/client";
import { currentUser } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";

export async function createHighlight(data: {
  title: string;
  desc: string;
  coverUrl?: string;
  storyIds: number[];
}) {
  const user = await currentUser();
  if (!user?.id) throw new Error("Not authenticated");

  try {
    // Fetch active stories
    const activeStories = await prisma.story.findMany({
      where: { id: { in: data.storyIds }, userId: user.id },
    });

    // Fetch archived stories
    const missingIds = data.storyIds.filter(
      (id) => !activeStories.some((s) => s.id === id)
    );
    const archivedStories = await prisma.archivedStory.findMany({
      where: { id: { in: missingIds }, userId: user.id },
    });

    if (!activeStories.length && !archivedStories.length) {
      throw new Error("No valid stories found to highlight.");
    }

    // Determine cover image
    const coverUrl =
      data.coverUrl || activeStories[0]?.img || archivedStories[0]?.img;

    // Create highlight first
    const highlight = await prisma.highlight.create({
      data: {
        title: data.title,
        desc: data.desc,
        coverUrl,
        userId: user.id,
      },
    });

    // Attach active stories
    for (let i = 0; i < activeStories.length; i++) {
      await prisma.highlightStory.create({
        data: {
          highlightId: highlight.id,
          storyId: activeStories[i].id,
          order: i,
        },
      });
    }

    // Attach archived stories
    for (let i = 0; i < archivedStories.length; i++) {
      await prisma.highlightStory.create({
        data: {
          highlightId: highlight.id,
          archivedStoryId: archivedStories[i].id,
          order: activeStories.length + i,
        },
      });
    }

    // Return highlight with included stories
    const fullHighlight = await prisma.highlight.findUnique({
      where: { id: highlight.id },
      include: {
        stories: {
          include: { story: true, archivedStory: true },
          orderBy: { order: "asc" },
        },
      },
    });

    return { success: true, highlight: fullHighlight };
  } catch (error) {
    console.error("Failed to create highlight:", error);
    throw error;
  }
}


// Get user's highlights
export async function getUserHighlights(userId: string) {
  try {
    const highlights = await prisma.highlight.findMany({
      where: { userId },
      include: {
        stories: {
          include: {
            story: true,
          },
          orderBy: {
            order: "asc",
          },
        },
        _count: {
          select: {
            views: true,
            likes: true,
            comments: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return highlights;
  } catch (error) {
    console.error("Failed to fetch highlights:", error);
    throw error;
  }
}

// Get highlight details with all interactions
export async function getHighlightDetails(highlightId: number) {
  const user = await currentUser();

  try {
    const highlight = await prisma.highlight.findUnique({
      where: { id: highlightId },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            avatar: true,
            name: true,
            surname: true,
          },
        },
        stories: {
          include: {
            story: {
              include: {
                user: true,
              },
            },
          },
          orderBy: {
            order: "asc",
          },
        },
        views: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                avatar: true,
              },
            },
          },
          orderBy: {
            createdAt: "desc",
          },
        },
        likes: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                avatar: true,
              },
            },
          },
          orderBy: {
            createdAt: "desc",
          },
        },
        comments: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                avatar: true,
              },
            },
          },
          orderBy: {
            createdAt: "desc",
          },
        },
      },
    });

    if (!highlight) throw new Error("Highlight not found");

    // Record view if not owner
    if (user?.id && user.id !== highlight.userId) {
      await prisma.highlightView.upsert({
        where: {
          highlightId_userId: {
            highlightId,
            userId: user.id,
          },
        },
        create: {
          highlightId,
          userId: user.id,
        },
        update: {},
      });
    }

    return highlight;
  } catch (error) {
    console.error("Failed to fetch highlight details:", error);
    throw error;
  }
}

// Like a highlight
export async function likeHighlight(highlightId: number) {
  const user = await currentUser();
  if (!user?.id) throw new Error("Not authenticated");

  try {
    const existing = await prisma.highlightLike.findUnique({
      where: {
        highlightId_userId: {
          highlightId,
          userId: user.id,
        },
      },
    });

    if (existing) {
      await prisma.highlightLike.delete({
        where: { id: existing.id },
      });
      return { success: true, liked: false };
    } else {
      await prisma.highlightLike.create({
        data: {
          highlightId,
          userId: user.id,
        },
      });
      return { success: true, liked: true };
    }
  } catch (error) {
    console.error("Failed to like highlight:", error);
    throw error;
  }
}

// Add comment to highlight
export async function addHighlightComment(highlightId: number, desc: string) {
  const user = await currentUser();
  if (!user?.id) throw new Error("Not authenticated");

  try {
    const comment = await prisma.highlightComment.create({
      data: {
        highlightId,
        userId: user.id,
        desc,
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            avatar: true,
          },
        },
      },
    });

    revalidatePath("/");
    return { success: true, comment };
  } catch (error) {
    console.error("Failed to add comment:", error);
    throw error;
  }
}

// Delete highlight comment
export async function deleteHighlightComment(commentId: number) {
  const user = await currentUser();
  if (!user?.id) throw new Error("Not authenticated");

  try {
    const comment = await prisma.highlightComment.findUnique({
      where: { id: commentId },
      include: {
        highlight: true,
      },
    });

    if (!comment) throw new Error("Comment not found");

    // Only owner or highlight owner can delete
    if (comment.userId !== user.id && comment.highlight.userId !== user.id) {
      throw new Error("Not authorized");
    }

    await prisma.highlightComment.delete({
      where: { id: commentId },
    });

    revalidatePath("/");
    return { success: true };
  } catch (error) {
    console.error("Failed to delete comment:", error);
    throw error;
  }
}

// Reorder highlight stories
export async function reorderHighlightStories(
  highlightId: number,
  storyOrders: { storyId: number; order: number }[]
) {
  const user = await currentUser();
  if (!user?.id) throw new Error("Not authenticated");

  try {
    const highlight = await prisma.highlight.findUnique({
      where: { id: highlightId },
    });

    if (!highlight) throw new Error("Highlight not found");
    if (highlight.userId !== user.id) throw new Error("Not authorized");

    // Update all story orders
    await Promise.all(
      storyOrders.map((item) =>
        prisma.highlightStory.updateMany({
          where: {
            highlightId,
            storyId: item.storyId,
          },
          data: {
            order: item.order,
          },
        })
      )
    );

    revalidatePath("/");
    return { success: true };
  } catch (error) {
    console.error("Failed to reorder stories:", error);
    throw error;
  }
}

// Delete highlight
export async function deleteHighlight(highlightId: number) {
  const user = await currentUser();
  if (!user?.id) throw new Error("Not authenticated");

  try {
    const highlight = await prisma.highlight.findUnique({
      where: { id: highlightId },
      include: {
        stories: {
          include: {
            story: true,
          },
        },
      },
    });

    if (!highlight) throw new Error("Highlight not found");
    if (highlight.userId !== user.id) throw new Error("Not authorized");

    // Delete associated stories
    await Promise.all(
      highlight.stories
        .filter((hs) => hs.storyId !== null)
        .map((hs) =>
          prisma.story.delete({
            where: { id: hs.storyId! },
          })
        )
    );

    // Delete highlight (cascade will handle relations)
    await prisma.highlight.delete({
      where: { id: highlightId },
    });

    revalidatePath("/");
    return { success: true };
  } catch (error) {
    console.error("Failed to delete highlight:", error);
    throw error;
  }
}

// Update highlight cover
export async function updateHighlightCover(
  highlightId: number,
  coverUrl: string
) {
  const user = await currentUser();
  if (!user?.id) throw new Error("Not authenticated");

  try {
    const highlight = await prisma.highlight.findUnique({
      where: { id: highlightId },
    });

    if (!highlight) throw new Error("Highlight not found");
    if (highlight.userId !== user.id) throw new Error("Not authorized");

    await prisma.highlight.update({
      where: { id: highlightId },
      data: { coverUrl },
    });

    revalidatePath("/");
    return { success: true };
  } catch (error) {
    console.error("Failed to update cover:", error);
    throw error;
  }
}
