// /actions/pollActions.ts
"use server";
import prisma from "@/lib/client";
import { revalidatePath } from "next/cache";
import { auth } from "@clerk/nextjs/server";
import { assertCanViewPost } from "@/lib/social-access";

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
  const session = await auth();
  if (!session.userId || session.userId !== userId) return { error: "Not authenticated or unauthorized." };
  if (typeof question !== "string" || question.length > 2000 || !Array.isArray(options) || options.some((option) => typeof option !== "string" || option.length > 255)) {
    return { error: "Invalid poll question or options." };
  }
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
  const session = await auth();
  if (!session.userId || session.userId !== userId) return { error: "Not authenticated or unauthorized." };
  if (!Number.isSafeInteger(pollId) || pollId < 1 || !Number.isSafeInteger(optionId) || optionId < 1) return { error: "Invalid poll or option." };
  try {
    const poll = await prisma.poll.findUnique({ where: { id: pollId } });
    if (!poll) return { error: "Poll not found." };
    await assertCanViewPost(session.userId, poll.postId);
    const newVote = await prisma.$transaction(async (tx) => {
      const currentPoll = await tx.poll.findUnique({ where: { id: pollId } });
      if (!currentPoll || currentPoll.expiresAt <= new Date()) throw new Error("Poll expired");
      const option = await tx.pollOption.findFirst({ where: { id: optionId, pollId }, select: { id: true } });
      if (!option) throw new Error("Option does not belong to this poll");
      const existingVote = await tx.pollVote.findFirst({ where: { userId: session.userId!, option: { pollId } } });
      if (existingVote) throw new Error("Already voted");
      return tx.pollVote.create({ data: { userId: session.userId!, optionId } });
    }, { isolationLevel: "Serializable" });

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
    const { userId } = await auth();
    if (!userId) return { error: "Not authenticated." };
    const poll = await prisma.poll.findUnique({ where: { id: pollId }, select: { postId: true } });
    if (!poll) return { error: "Poll not found." };
    await assertCanViewPost(userId, poll.postId);
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
