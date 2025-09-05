import React from "react";
import FriendRequests from "./FriendRequests";
import Birthdays from "./Birthdays";
import Ad from "./Ad";

const RightMenu = ({ children }: { children?: React.ReactNode }) => {
  return (
    <div className="flex flex-col gap-6">
      {children}
      <FriendRequests />
      <Birthdays />
      <Ad size="md" />
    </div>
  );
};

export default RightMenu;
