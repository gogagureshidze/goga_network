import Feed from "@/components/Feed";
import LeftMenu from "@/components/LeftMenu";
import RightMenu from "@/components/RightMenu";
import Image from "next/image";

function ProfilePage() {
  return (
    <div className="flex gap-6 pt-6">
      <div className="hidden xl:block w-[20%]">
        <LeftMenu type="profile" />
      </div>

      <div className="w-full lg:w-[60%] xl:w-[50%]">
        <div className="flex flex-col gap-6">
          {/* Banner + Avatar */}
          <div className="relative w-full h-64">
            <Image
              src="https://static.vecteezy.com/system/resources/previews/027/231/618/non_2x/illustration-graphic-of-aesthetic-background-template-with-subtle-pastel-colors-and-nature-motifs-vector.jpg"
              alt="Banner"
              fill
              className="object-cover rounded-lg"
              priority
            />
            <div className="absolute bottom-[-3rem] left-1/2 transform -translate-x-1/2 z-10">
              <Image
                src="https://instagram.ftbs10-1.fna.fbcdn.net/v/t51.29350-15/453144461_1855041181639717_8895810564975077718_n.jpg?stp=dst-jpg_e35_p412x412_tt6&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0uaW1hZ2VfdXJsZ2VuLjE0NDB4MTgwMC5zZHIuZjI5MzUwLmRlZmF1bHRfaW1hZ2UifQ&_nc_ht=instagram.ftbs10-1.fna.fbcdn.net&_nc_cat=101&_nc_oc=Q6cZ2QEo5XdyTCk37xUkQ_6a3KrXqGWIecngKCMkBlpzFb_8oJAjHqD9FujVlcNYNOC20Z4&_nc_ohc=66La8rdi08QQ7kNvwGvB-Dn&_nc_gid=DZQxGiXkA7p_47IpnzLVJw&edm=AP4sbd4BAAAA&ccb=7-5&ig_cache_key=MzQyMjMxMDExMjc1NzM0Mzk5Mw%3D%3D.3-ccb7-5&oh=00_AfPufTy404pFXC1oon-FP8IR9ena9MUFnPIB5jQiEAlg5g&oe=686501B6&_nc_sid=7a9f4b"
                alt="Avatar"
                width={200}
                height={200}
                className="rounded-full ring-2 ring-white object-cover aspect-square"
              />
            </div>
          </div>

          {/* Spacer for avatar */}

          {/* Name */}
          <h1 className="text-center text-2xl font-medium mt-[45px]">
            Anna Ambroladze
          </h1>
          <div className="flex items-center justify-center gap-12 mb-4">
            <div className="flex flex-col items-center">
              <span className="font-medium  text-orange-400">16</span>
              <span className="text-sm">Posts</span>
            </div>

            <div className="flex flex-col items-center">
              <span className="font-medium  text-orange-400">201</span>
              <span className="text-sm">Followers</span>
            </div>

            <div className="flex flex-col items-center">
              <span className="font-medium  text-orange-400">201</span>
              <span className="text-sm">Following</span>
            </div>
          </div>
          <Feed />
        </div>
      </div>

      <div className="hidden lg:block w-[30%]">
        <RightMenu userId="test" />
      </div>
    </div>
  );
}

export default ProfilePage;
