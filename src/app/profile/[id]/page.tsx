import Feed from "@/components/Feed";
import LeftMenu from "@/components/LeftMenu";
import RightMenu from "@/components/RightMenu";

function ProfilePage() {
  return (
    <div className="flex gap-6 pt-6">
      <div className="hidden xl:block w-[20%]">
        <LeftMenu></LeftMenu>
      </div>

      <div className="w-full lg:w-[70%] xl:w[50%]">
        <div className="flex flex-col gap-6">
          <Feed />
        </div>
      </div>

      <div className="hidden lg:block w-[70%]">
        <RightMenu userId="test"></RightMenu>
      </div>
    </div>
  );
}

export default ProfilePage;