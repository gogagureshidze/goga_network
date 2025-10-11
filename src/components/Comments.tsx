import prisma from "@/lib/client";
import CommentList from "./CommentList";
import { currentUser } from "@clerk/nextjs/server";
import { Suspense } from "react";

const Comments = async ({ postId }: { postId: number }) => {
  const comments = await prisma.comment.findMany({
    where: {
      postId,
    },
    include: {
      user: true,
      likes: true,
    },
    orderBy: {
      createdAt: "desc", // Good practice to order by newest first
    },
  });
  const user = await currentUser();
  const username = user?.username;
  return (
    <div className="">
      <Suspense
        fallback={<p className="text-sm text-gray-400">Loading comments...</p>}
      >
        <CommentList comments={comments} postId={postId} username={username} />
      </Suspense>
    </div>
  );
};

export default Comments;
