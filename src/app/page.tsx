import AddPost from "@/components/AddPost";
import Feed from "@/components/Feed";
import LeftMenu from "@/components/LeftMenu";
import OnlineUsers from "@/components/OnlineUsers";
import RightMenu from "@/components/RightMenu";
import Stories from "@/components/Stories";
import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Greet from "@/components/Greet";

const Homepage = async () => {
  const user = await currentUser();
  if (!user) {
    redirect("/sign-in");
  }
  return (
    <div className="flex gap-6 pt-6 px-4 md:px-6">
      {/* Left Menu - Fixed width on XL screens */}
      <div className="hidden xl:block w-[20%] flex-shrink-0">
        <LeftMenu type="home" />
      </div>

      {/* Center Content - Flexible, gets most space */}
      <div className="w-full lg:w-[50%] xl:w-[50%] flex-grow">
        <div className="flex flex-col gap-6">
          <Stories />
          <AddPost />
          <div className="block lg:hidden">
            <OnlineUsers />
          </div>
          <div>
            <Greet userName={user?.firstName ?? undefined} />
          </div>
          <Feed />
        </div>
      </div>

      {/* Right Menu - Fixed width on LG+ screens */}
      <div className="hidden lg:block w-[30%] flex-shrink-0">
        <RightMenu />
      </div>
    </div>
  );
};

export default Homepage;
