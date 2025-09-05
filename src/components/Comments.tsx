import prisma from "@/lib/client";
import CommentList from "./CommentList";
import { currentUser } from "@clerk/nextjs/server";

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
      {/* The client component for the comment form and list */}
      <CommentList comments={comments} postId={postId} username={username} />
    </div>
  );
};

export default Comments;
