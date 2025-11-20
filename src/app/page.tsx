import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Feed from "@/components/Feed";
import LeftMenu from "@/components/LeftMenu";
import Stories from "@/components/Stories";
import AddPost from "@/components/AddPost";
import RightMenu from "@/components/RightMenu";

const Homepage = async () => {
  const user = await currentUser();
  if (!user) {
    redirect("/sign-in");
  }

  return (
    <div className="flex justify-center">
      <div className="flex gap-6 pt-6 px-4 w-full max-w-[1600px]">
        {/* LEFT MENU */}
        <div className="hidden xl:block w-[280px] flex-shrink-0">
          <div className="sticky top-6">
            <LeftMenu type="home" />
          </div>
        </div>

        {/* CENTER COLUMN */}
        <div className="flex-1 max-w-[680px] mx-auto space-y-6">
          <Stories />
          <AddPost />
          {/* Feed now includes OnlineUsers and WeatherToggleWrapper inside the scroll */}
          <Feed showOnMobile={true} />
        </div>

        {/* RIGHT MENU */}
        <div className="hidden lg:block w-[320px] flex-shrink-0">
          <div className="sticky top-6">
            <RightMenu />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Homepage;
