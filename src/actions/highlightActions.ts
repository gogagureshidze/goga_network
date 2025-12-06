"use server";

import prisma from "@/lib/client";
import { currentUser } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";

export async function createHighlight(data: {
  title: string;
  desc: string;
  coverUrl?: string;
  storyIds: number[]; // This array has the CORRECT order
}) {
  const user = await currentUser();
  if (!user?.id) throw new Error("Not authenticated");

  try {
    // 1. Fetch stories to validate existence and determine type (Active vs Archived)
    // We cannot trust the order of these results from the DB.
    const activeStories = await prisma.story.findMany({
      where: { id: { in: data.storyIds }, userId: user.id },
    });

    const archivedStories = await prisma.archivedStory.findMany({
      where: { id: { in: data.storyIds }, userId: user.id },
    });

    if (!activeStories.length && !archivedStories.length) {
      throw new Error("No valid stories found to highlight.");
    }

    // 2. Create optimized Lookup Maps for O(1) access
    // This lets us check "Is ID #123 active or archived?" instantly
    const activeMap = new Map(activeStories.map((s) => [s.id, s]));
    const archivedMap = new Map(archivedStories.map((s) => [s.id, s]));

    // 3. Determine cover image
    // If cover is provided use it, otherwise grab the image of the FIRST story in the sorted list
    let coverUrl = data.coverUrl;
    if (!coverUrl) {
      const firstId = data.storyIds[0];
      const firstStory = activeMap.get(firstId) || archivedMap.get(firstId);
      coverUrl = firstStory?.img || "";
    }

    // 4. Create the Highlight Container
    const highlight = await prisma.highlight.create({
      data: {
        title: data.title,
        desc: data.desc,
        coverUrl,
        userId: user.id,
      },
    });

    // 5. Create Relations Preserving Order
    // We loop through the INPUT array (data.storyIds) because that has the user's sort order.
    // We use a Transaction to ensure all insert successfully.

    await prisma.$transaction(
      data.storyIds.map((storyId, index) => {
        // Determine if this ID belongs to Active or Archived
        if (activeMap.has(storyId)) {
          return prisma.highlightStory.create({
            data: {
              highlightId: highlight.id,
              storyId: storyId,
              order: index, // ✅ This guarantees the Frontend order is saved
            },
          });
        } else if (archivedMap.has(storyId)) {
          return prisma.highlightStory.create({
            data: {
              highlightId: highlight.id,
              archivedStoryId: storyId,
              order: index, // ✅ This guarantees the Frontend order is saved
            },
          });
        } else {
          // Should technically not happen if fetches worked, but safe to ignore
          // or throw error depending on strictness. We'll skip invalid IDs.
          // Prisma transaction expects promises, so we return a dummy promise that resolves.
          // However, mapping requires returning a Prisma Promise.
          // Since we filtered earlier, we can assume valid.
          // If strictly needed, we can filter data.storyIds before mapping.
          throw new Error(`Story ID ${storyId} not found in user's history.`);
        }
      })
    );

    // 6. Return result
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
export async function getHighlightDetails(highlightId: number) {
  const user = await currentUser();
  let currentUserId = user?.id;
  let currentUserAvatar = user?.imageUrl;

  if (currentUserId) {
    const dbUser = await prisma.user.findUnique({
      where: { id: currentUserId },
      select: { avatar: true },
    });
    if (dbUser?.avatar) currentUserAvatar = dbUser.avatar;
  }

  try {
    const highlight = await prisma.highlight.findUnique({
      where: { id: highlightId },
      include: {
        user: { select: { id: true, username: true, avatar: true } },
        stories: {
          include: {
            story: {
              include: {
                user: true,
                likes: { include: { user: true } },
                comments: {
                  include: { user: true },
                  orderBy: { createdAt: "desc" },
                },
                views: { include: { user: true } },
              },
            },
            archivedStory: {
              include: {
                likes: true,
                comments: { orderBy: { createdAt: "desc" } },
                views: true,
              },
            },
          },
          orderBy: { order: "asc" },
        },
      },
    });

    if (!highlight) throw new Error("Highlight not found");

    const processedStories = highlight.stories.map((hs) => {
      const active = hs.story;
      const archived = hs.archivedStory;

      let isLiked = false;
      let likesList: any[] = [];
      let commentsList: any[] = [];
      let viewsList: any[] = [];

      if (active) {
        isLiked = currentUserId
          ? active.likes.some((l) => l.userId === currentUserId)
          : false;
        likesList = active.likes;
        commentsList = active.comments;
        viewsList = active.views;
      } else if (archived) {
        isLiked = currentUserId
          ? archived.likes.some((l) => l.userId === currentUserId)
          : false;
        likesList = archived.likes;
        commentsList = archived.comments;
        viewsList = archived.views;
      }

      // ✅ FIX: Filter out the Highlight Creator from the views list
      viewsList = viewsList.filter((v) => v.userId !== highlight.userId);

      return {
        ...hs,
        context: { isLiked, likesList, commentsList, viewsList },
      };
    });

    if (user?.id && user.id !== highlight.userId) {
      await prisma.highlightView.upsert({
        where: { highlightId_userId: { highlightId, userId: user.id } },
        create: { highlightId, userId: user.id },
        update: {},
      });
    }

    return {
      ...highlight,
      stories: processedStories,
      currentUserId,
      currentUserAvatar,
    };
  } catch (error) {
    console.error("Failed to fetch details:", error);
    throw error;
  }
}

// ✅ NEW: Comment on specific story
export async function commentOnStory(
  storyId: number,
  isArchived: boolean,
  text: string
) {
  const user = await currentUser();
  if (!user?.id) throw new Error("Unauthorized");

  try {
    let newComment;

    if (!isArchived) {
      // 1. Create Active Comment
      newComment = await prisma.storyComment.create({
        data: { storyId, userId: user.id, desc: text },
      });
    } else {
      // 2. Create Archived Comment
      newComment = await prisma.archivedStoryComment.create({
        data: {
          archivedStoryId: storyId,
          userId: user.id,
          username: user.username,
          userAvatar: user.imageUrl,
          desc: text,
          createdAt: new Date(),
        },
      });
    }

    // ✅ RETURN THE NEW COMMENT (So frontend can get the Real ID)
    return { success: true, newComment };
  } catch (e) {
    throw new Error("Comment failed");
  }
}
// Like a highlight
export async function toggleStoryLike(storyId: number, isArchived: boolean) {
  const user = await currentUser();
  if (!user?.id) throw new Error("Not authenticated");

  try {
    if (!isArchived) {
      // ---------------------------------------------------------
      // 1. HANDLE ACTIVE STORY (Standard 'Like' Model)
      // ---------------------------------------------------------
      const existingLike = await prisma.like.findFirst({
        where: {
          storyId: storyId,
          userId: user.id,
        },
      });

      if (existingLike) {
        // UNLIKE
        await prisma.like.delete({
          where: { id: existingLike.id },
        });
        return { success: true, liked: false };
      } else {
        // LIKE
        await prisma.like.create({
          data: {
            storyId: storyId,
            userId: user.id,
          },
        });
        return { success: true, liked: true };
      }
    } else {
      // ---------------------------------------------------------
      // 2. HANDLE ARCHIVED STORY ('ArchivedStoryLike' Model)
      // ---------------------------------------------------------
      const existingArchivedLike = await prisma.archivedStoryLike.findFirst({
        where: {
          archivedStoryId: storyId,
          userId: user.id,
        },
      });

      if (existingArchivedLike) {
        // UNLIKE
        await prisma.archivedStoryLike.delete({
          where: { id: existingArchivedLike.id },
        });
        return { success: true, liked: false };
      } else {
        // LIKE
        // We snapshot user details because archived data is historical
        await prisma.archivedStoryLike.create({
          data: {
            archivedStoryId: storyId,
            userId: user.id,
            username: user.username || "User",
            userAvatar: user.imageUrl,
            createdAt: new Date(),
          },
        });
        return { success: true, liked: true };
      }
    }
  } catch (error) {
    console.error("Failed to toggle story like:", error);
    throw new Error("Failed to like story");
  }
}


// Delete highlight comment
export async function deleteStoryComment(
  commentId: number,
  isArchived: boolean
) {
  const user = await currentUser();
  if (!user?.id) throw new Error("Not authenticated");

  try {
    if (!isArchived) {
      // Active Comment
      const comment = await prisma.storyComment.findUnique({
        where: { id: commentId },
        include: { story: true },
      });
      if (!comment) throw new Error("Not found");

      // 🔒 Allow if: User is Commenter OR User is Story Owner
      if (comment.userId !== user.id && comment.story.userId !== user.id) {
        throw new Error("Unauthorized");
      }

      await prisma.storyComment.delete({ where: { id: commentId } });
    } else {
      // Archived Comment
      const comment = await prisma.archivedStoryComment.findUnique({
        where: { id: commentId },
        include: { archivedStory: true },
      });
      if (!comment) throw new Error("Not found");

      if (
        comment.userId !== user.id &&
        comment.archivedStory.userId !== user.id
      ) {
        throw new Error("Unauthorized");
      }

      await prisma.archivedStoryComment.delete({ where: { id: commentId } });
    }
    return { success: true };
  } catch (error) {
    console.error("Failed to delete comment:", error);
    throw error;
  }
}
// Reorder highlight stories
export async function reorderHighlightStories(
  highlightId: number,
  items: { id: number; order: number }[]
) {
  const user = await currentUser();
  if (!user?.id) throw new Error("Not authenticated");

  try {
    const highlight = await prisma.highlight.findUnique({
      where: { id: highlightId },
    });

    if (!highlight || highlight.userId !== user.id)
      throw new Error("Not authorized");

    // Transaction ensures all updates apply or none do
    await prisma.$transaction(
      items.map((item) =>
        prisma.highlightStory.update({
          where: { id: item.id }, // We update the HighlightStory row directly
          data: { order: item.order },
        })
      )
    );

    revalidatePath(`/highlights/${highlightId}`); // Refresh the page cache
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

export async function removeStoryFromHighlight(highlightStoryId: number) {
  const user = await currentUser();
  if (!user?.id) throw new Error("Not authenticated");

  try {
    // 1. Find the entry to check ownership and get the Parent Highlight ID
    const entry = await prisma.highlightStory.findUnique({
      where: { id: highlightStoryId },
      include: { highlight: true },
    });

    if (!entry) throw new Error("Story entry not found");
    if (entry.highlight.userId !== user.id) throw new Error("Not authorized");

    // 2. Count how many stories are in this highlight
    const storyCount = await prisma.highlightStory.count({
      where: { highlightId: entry.highlightId },
    });

    // 3. Logic: Delete Highlight if it's the last story, otherwise just delete the story link
    if (storyCount <= 1) {
      // DELETE ENTIRE HIGHLIGHT (Cascade will remove the story entry)
      await prisma.highlight.delete({
        where: { id: entry.highlightId },
      });

      revalidatePath("/");
      // Return a flag so the frontend knows to redirect the user away
      return { success: true, isEmpty: true };
    } else {
      // DELETE JUST THE STORY ENTRY
      await prisma.highlightStory.delete({
        where: { id: highlightStoryId },
      });

      revalidatePath("/");
      return { success: true, isEmpty: false };
    }
  } catch (error) {
    console.error("Failed to remove story from highlight:", error);
    throw error;
  }
}


export async function viewStory(storyId: number, isArchived: boolean) {
  const user = await currentUser();
  if (!user?.id) return; // Views don't strictly require auth, but tracking does

  try {
    if (!isArchived) {
      // 1. Active Story View
      // Check if view exists to avoid unique constraint errors
      const existing = await prisma.storyView.findUnique({
        where: {
          storyId_userId: {
            storyId,
            userId: user.id,
          },
        },
      });

      if (!existing) {
        await prisma.storyView.create({
          data: {
            storyId,
            userId: user.id,
          },
        });
      }
    } else {
      // 2. Archived Story View
      // Note: ArchivedStoryView might not have a unique constraint in some schemas,
      // but logically a user views it once.
      const existing = await prisma.archivedStoryView.findFirst({
        where: {
          archivedStoryId: storyId,
          userId: user.id,
        },
      });

      if (!existing) {
        await prisma.archivedStoryView.create({
          data: {
            archivedStoryId: storyId,
            userId: user.id,
            username: user.username,
            userAvatar: user.imageUrl,
            createdAt: new Date(),
          },
        });
      }
    }
    return { success: true };
  } catch (error) {
    // We fail silently for views - no need to alert the user
    console.error("Failed to record view:", error);
    return { success: false };
  }
}

export async function getArchivedStoriesForSelection(highlightId: number) {
  const user = await currentUser();
  if (!user?.id) throw new Error("Not authenticated");

  try {
    // 1. Get IDs of stories already in this highlight
    const existingEntries = await prisma.highlightStory.findMany({
      where: { highlightId },
      select: { archivedStoryId: true },
    });

    const existingIds = existingEntries
      .map((e) => e.archivedStoryId)
      .filter((id): id is number => id !== null);

    // 2. Fetch user's archived stories excluding existing ones
    const archives = await prisma.archivedStory.findMany({
      where: {
        userId: user.id,
        id: { notIn: existingIds }, // Exclude current
      },
      orderBy: { createdAt: "desc" },
      select: { id: true, img: true, createdAt: true },
    });

    return archives;
  } catch (error) {
    console.error("Failed to fetch archives:", error);
    return [];
  }
}

// ✅ NEW: Add selected stories to highlight
export async function addStoriesToHighlight(
  highlightId: number,
  storyIds: number[]
) {
  const user = await currentUser();
  if (!user?.id) throw new Error("Not authenticated");

  try {
    // 1. Verify Ownership
    const highlight = await prisma.highlight.findUnique({
      where: { id: highlightId },
    });
    if (highlight?.userId !== user.id) throw new Error("Unauthorized");

    // 2. Get current highest order to append to the end
    const lastStory = await prisma.highlightStory.findFirst({
      where: { highlightId },
      orderBy: { order: "desc" },
    });
    let startOrder = (lastStory?.order ?? -1) + 1;

    // 3. Create entries
    await prisma.$transaction(
      storyIds.map((storyId, index) =>
        prisma.highlightStory.create({
          data: {
            highlightId,
            archivedStoryId: storyId,
            order: startOrder + index,
          },
        })
      )
    );

    revalidatePath(`/highlights/${highlightId}`);
    return { success: true };
  } catch (error) {
    console.error("Failed to add stories:", error);
    throw error;
  }
}



// ... existing imports

// ✅ NEW: Update Title & Description
export async function updateHighlightDetails(highlightId: number, title: string, desc: string) {
  const user = await currentUser();
  if (!user?.id) throw new Error("Not authenticated");

  try {
    const highlight = await prisma.highlight.findUnique({
      where: { id: highlightId },
    });

    if (!highlight || highlight.userId !== user.id) throw new Error("Unauthorized");

    await prisma.highlight.update({
      where: { id: highlightId },
      data: { 
        title: title.trim(), 
        desc: desc.trim() 
      },
    });

    revalidatePath(`/highlights/${highlightId}`);
    return { success: true };
  } catch (error) {
    console.error("Failed to update highlight details:", error);
    throw error;
  }
}


export async function toggleCommentLike(
  commentId: number,
  isArchived: boolean
) {
  const user = await currentUser();
  if (!user?.id) throw new Error("Not authenticated");

  try {
    if (!isArchived) {
      // 1. ACTIVE STORY COMMENT
      const comment = await prisma.storyComment.findUnique({
        where: { id: commentId },
        include: { story: { include: { user: true } } }, // Need story owner to verify
      });

      if (!comment) throw new Error("Comment not found");

      // 🔒 SECURITY: Only Story Owner can like comments
      if (comment.story.userId !== user.id)
        throw new Error("Only the author can like comments");

      const existingLike = await prisma.like.findFirst({
        where: { storyCommentId: commentId, userId: user.id },
      });

      if (existingLike) {
        await prisma.like.delete({ where: { id: existingLike.id } });
        return { liked: false };
      } else {
        await prisma.like.create({
          data: { storyCommentId: commentId, userId: user.id },
        });
        return { liked: true };
      }
    } else {
      // 2. ARCHIVED STORY COMMENT
      // Since schema usually only has 'likesCount' for archived, and ONLY author can like:
      // We treat likesCount 1 as "Liked by Author", 0 as "Not Liked".
      const comment = await prisma.archivedStoryComment.findUnique({
        where: { id: commentId },
        include: { archivedStory: true },
      });

      if (!comment) throw new Error("Comment not found");
      if (comment.archivedStory.userId !== user.id)
        throw new Error("Only the author can like comments");

      if (comment.likesCount > 0) {
        await prisma.archivedStoryComment.update({
          where: { id: commentId },
          data: { likesCount: 0 },
        });
        return { liked: false };
      } else {
        await prisma.archivedStoryComment.update({
          where: { id: commentId },
          data: { likesCount: 1 },
        });
        return { liked: true };
      }
    }
  } catch (error) {
    console.error("Failed to toggle comment like:", error);
    throw error;
  }
}