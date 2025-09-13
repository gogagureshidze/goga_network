import AddPost from "@/components/AddPost";
import Feed from "@/components/Feed";
import LeftMenu from "@/components/LeftMenu";
import RightMenu from "@/components/RightMenu";
import Stories from "@/components/Stories";
import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

const Homepage = async () => {
  const user = await currentUser();
  if (!user) {
    redirect("/sign-in");
  }
  return (
    <div className="flex gap-6 pt-6">
      <div className="hidden xl:block w-[20%]">
        <LeftMenu type="home"></LeftMenu>
      </div>

      <div className="w-full lg:w-[70%] xl:w[50%]">
        <div className="flex flex-col gap-6">
          <Stories />
          <AddPost />
          <Feed />
        </div>
      </div>

      <div className="hidden lg:block w-[70%]">
        <RightMenu></RightMenu>
      </div>
    </div>
  );
};

export default Homepage;
