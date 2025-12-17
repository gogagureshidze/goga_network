// /actions/pollActions.ts
"use server";
import prisma from "@/lib/client";
import { revalidatePath } from "next/cache";

// =================================================================
// 1. ACTION: CREATE A NEW POLL POST
// =================================================================

interface PollCreationData {
  userId: string;
  question: string;
  options: string[];
}

/**
 * Creates a new Post, a related Poll, and all PollOption records in a transaction.
 */
export async function createPollPost({
  userId,
  question,
  options,
}: PollCreationData) {
  const validOptions = options.filter((opt) => opt.trim().length > 0);

  if (validOptions.length < 2 || validOptions.length > 5) {
    return { error: "A poll must have between 2 and 5 non-empty options." };
  }
  if (!question.trim()) {
    return { error: "Poll question cannot be empty." };
  }

  const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);

  try {
    const newPost = await prisma.$transaction(async (tx) => {
      // 1️⃣ Create post
      const post = await tx.post.create({
        data: {
          userId,
          desc: question,
        },
      });

      // 2️⃣ Create poll
      const poll = await tx.poll.create({
        data: {
          postId: post.id,
          expiresAt: expiresAt,
        },
      });

      // 3️⃣ Create poll options
      const optionData = validOptions.map((text) => ({
        pollId: poll.id,
        text: text.trim(),
      }));
      await tx.pollOption.createMany({ data: optionData });

      // 4️⃣ Handle @mentions inside transaction
      const mentionRegex = /@(\w+)/g;
      const mentions = [...question.matchAll(mentionRegex)].map((m) => m[1]);

      if (mentions.length > 0) {
        const taggedUsers = await tx.user.findMany({
          where: { username: { in: mentions } },
          select: { id: true },
        });

        if (taggedUsers.length > 0) {
          await tx.postTag.createMany({
            data: taggedUsers.map((u) => ({ postId: post.id, userId: u.id })),
            skipDuplicates: true,
          });
        }
      }

      return post; // return post at the end
    });

    // 5️⃣ Revalidate caches
    revalidatePath("/", "layout");
    revalidatePath("/home");
    const { revalidateTag } = await import("next/cache");
    // @ts-ignore
    revalidateTag("feed-posts");
    // @ts-ignore
    revalidateTag("profile-posts");
    // @ts-ignore
    revalidateTag("following-list");

    return { post: newPost };
  } catch (err) {
    console.error("Poll creation failed:", err);
    return { error: "Failed to create poll post. Please try again." };
  }
}

// =================================================================
// 2. ACTION: CAST A VOTE
// =================================================================

interface PollVoteData {
  userId: string;
  pollId: number;
  optionId: number;
}

/**
 * Allows a user to cast a vote on a specific poll option.
 * Checks for expiration and existing votes within the same poll.
 */
export async function castPollVote({ userId, pollId, optionId }: PollVoteData) {
  try {
    const poll = await prisma.poll.findUnique({
      where: { id: pollId },
    });

    if (!poll || poll.expiresAt < new Date()) {
      return { error: "This poll has expired and can no longer accept votes." };
    }

    const existingVote = await prisma.pollVote.findFirst({
      where: {
        userId: userId,
        option: {
          pollId: pollId,
        },
      },
    });

    if (existingVote) {
      return { error: "You have already voted in this poll." };
    }

    const newVote = await prisma.pollVote.create({
      data: {
        userId: userId,
        optionId: optionId,
      },
    });

    // Clear caches
    revalidatePath("/", "layout");
    revalidatePath("/home");
    const { revalidateTag } = await import("next/cache");
    // @ts-ignore
    revalidateTag("feed-posts");
    // @ts-ignore
    revalidateTag("profile-posts");

    return { vote: newVote };
  } catch (err) {
    console.error("Poll vote failed:", err);
    return { error: "Failed to cast vote. You may have already voted." };
  }
}

// =================================================================
// 3. ACTION: FETCH POLL RESULTS
// =================================================================

/**
 * Fetches all necessary data (options and vote counts) to display the poll results.
 */
export async function getPollResults(pollId: number) {
  try {
    const results = await prisma.poll.findUnique({
      where: { id: pollId },
      select: {
        expiresAt: true,
        options: {
          select: {
            id: true,
            text: true,
            _count: {
              select: { votes: true }, // Count all votes for this option
            },
          },
        },
        post: {
          select: { id: true },
        },
      },
    });

    if (!results) {
      return { error: "Poll not found." };
    }

    // Calculate total votes for the poll
    const totalVotes = results.options.reduce(
      (sum, option) => sum + option._count.votes,
      0
    );

    // Format the results for easy client-side use
    const formattedResults = results.options.map((option) => ({
      id: option.id,
      text: option.text,
      voteCount: option._count.votes,
      percentage: totalVotes > 0 ? (option._count.votes / totalVotes) * 100 : 0,
    }));

    return {
      results: formattedResults,
      totalVotes,
      expiresAt: results.expiresAt,
    };
  } catch (err) {
    console.error("Failed to fetch poll results:", err);
    return { error: "Failed to fetch poll results." };
  }
}
