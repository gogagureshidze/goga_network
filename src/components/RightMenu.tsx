import React, { Suspense } from "react";
import FriendRequests from "./FriendRequests";
import Ad from "./Ad";
import OnlineUsers from "./OnlineUsers";
import { currentUser } from "@clerk/nextjs/server";

const RightMenu = async ({ children }: { children?: React.ReactNode }) => {
  // Use await with currentUser() as it is an asynchronous function
  const user = await currentUser();

  return (
    <div className="flex flex-col gap-6">
      {children}
      <FriendRequests />
      {user && (
        <Suspense fallback={<div>Loading...</div>}>
          <OnlineUsers />
        </Suspense>
      )}
      <Ad size="md" />
    </div>
  );
};

export default RightMenu;
