import React from "react";
import FriendRequests from "./FriendRequests";
import Birthdays from "./Birthdays";
import Ad from "./Ad";

type RightMenuProps = {
  userId: string;
};

const RightMenu = ({ userId }: { userId?: string }) => {
  return (
    <div className="flex flex-col gap-6">
      <FriendRequests />
      <Birthdays />
      <Ad size="md"/>
    </div>
  );
};

export default RightMenu;
