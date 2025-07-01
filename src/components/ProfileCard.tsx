import Image from "next/image";
import React from "react";

function ProfileCard() {
  return (
    <div className="p-4 bg-white rounded-lg shadow-md text-sm flex flex-col gap-6">
      <div className="h-20 relative">
        <Image
          className="rounded-md object-cover"
          fill
          alt="Background aesthetic"
          src="https://static.vecteezy.com/system/resources/previews/027/231/618/non_2x/illustration-graphic-of-aesthetic-background-template-with-subtle-pastel-colors-and-nature-motifs-vector.jpg"
        />
        <Image
          className="rounded-full w-12 h-12 absolute object-cover left-0 right-0 m-auto -bottom-6 ring-1 ring-white z-10"
          width={48}
          height={48}
          alt="Profile picture"
          src="https://instagram.ftbs10-1.fna.fbcdn.net/v/t51.29350-15/453144461_1855041181639717_8895810564975077718_n.jpg?stp=dst-jpg_e35_p412x412_tt6&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0uaW1hZ2VfdXJsZ2VuLjE0NDB4MTgwMC5zZHIuZjI5MzUwLmRlZmF1bHRfaW1hZ2UifQ&_nc_ht=instagram.ftbs10-1.fna.fbcdn.net&_nc_cat=101&_nc_oc=Q6cZ2QEo5XdyTCk37xUkQ_6a3KrXqGWIecngKCMkBlpzFb_8oJAjHqD9FujVlcNYNOC20Z4&_nc_ohc=66La8rdi08QQ7kNvwGvB-Dn&_nc_gid=DZQxGiXkA7p_47IpnzLVJw&edm=AP4sbd4BAAAA&ccb=7-5&ig_cache_key=MzQyMjMxMDExMjc1NzM0Mzk5Mw%3D%3D.3-ccb7-5&oh=00_AfPufTy404pFXC1oon-FP8IR9ena9MUFnPIB5jQiEAlg5g&oe=686501B6&_nc_sid=7a9f4b"
        />
      </div>
      <div className="h-20 flex flex-col gap-2 items-center my-2">
        <span className="font-semibold">Anna Ambroladze</span>
        <div className="flex items-center gap-4">
          <div className="flex">
            <Image
              className="rounded-full object-cover w-3 h-3"
              width={12}
              height={12}
              alt="Profile picture"
              src="https://instagram.ftbs10-1.fna.fbcdn.net/v/t51.29350-15/453144461_1855041181639717_8895810564975077718_n.jpg?stp=dst-jpg_e35_p412x412_tt6&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0uaW1hZ2VfdXJsZ2VuLjE0NDB4MTgwMC5zZHIuZjI5MzUwLmRlZmF1bHRfaW1hZ2UifQ&_nc_ht=instagram.ftbs10-1.fna.fbcdn.net&_nc_cat=101&_nc_oc=Q6cZ2QEo5XdyTCk37xUkQ_6a3KrXqGWIecngKCMkBlpzFb_8oJAjHqD9FujVlcNYNOC20Z4&_nc_ohc=66La8rdi08QQ7kNvwGvB-Dn&_nc_gid=DZQxGiXkA7p_47IpnzLVJw&edm=AP4sbd4BAAAA&ccb=7-5&ig_cache_key=MzQyMjMxMDExMjc1NzM0Mzk5Mw%3D%3D.3-ccb7-5&oh=00_AfPufTy404pFXC1oon-FP8IR9ena9MUFnPIB5jQiEAlg5g&oe=686501B6&_nc_sid=7a9f4b"
            />
            <Image
              className="rounded-full object-cover w-3 h-3"
              width={12}
              height={12}
              alt="Profile picture"
              src="https://instagram.ftbs10-1.fna.fbcdn.net/v/t51.29350-15/453144461_1855041181639717_8895810564975077718_n.jpg?stp=dst-jpg_e35_p412x412_tt6&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0uaW1hZ2VfdXJsZ2VuLjE0NDB4MTgwMC5zZHIuZjI5MzUwLmRlZmF1bHRfaW1hZ2UifQ&_nc_ht=instagram.ftbs10-1.fna.fbcdn.net&_nc_cat=101&_nc_oc=Q6cZ2QEo5XdyTCk37xUkQ_6a3KrXqGWIecngKCMkBlpzFb_8oJAjHqD9FujVlcNYNOC20Z4&_nc_ohc=66La8rdi08QQ7kNvwGvB-Dn&_nc_gid=DZQxGiXkA7p_47IpnzLVJw&edm=AP4sbd4BAAAA&ccb=7-5&ig_cache_key=MzQyMjMxMDExMjc1NzM0Mzk5Mw%3D%3D.3-ccb7-5&oh=00_AfPufTy404pFXC1oon-FP8IR9ena9MUFnPIB5jQiEAlg5g&oe=686501B6&_nc_sid=7a9f4b"
            />
            <Image
              className="rounded-full object-cover w-3 h-3"
              width={12}
              height={12}
              alt="Profile picture"
              src="https://instagram.ftbs10-1.fna.fbcdn.net/v/t51.29350-15/453144461_1855041181639717_8895810564975077718_n.jpg?stp=dst-jpg_e35_p412x412_tt6&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0uaW1hZ2VfdXJsZ2VuLjE0NDB4MTgwMC5zZHIuZjI5MzUwLmRlZmF1bHRfaW1hZ2UifQ&_nc_ht=instagram.ftbs10-1.fna.fbcdn.net&_nc_cat=101&_nc_oc=Q6cZ2QEo5XdyTCk37xUkQ_6a3KrXqGWIecngKCMkBlpzFb_8oJAjHqD9FujVlcNYNOC20Z4&_nc_ohc=66La8rdi08QQ7kNvwGvB-Dn&_nc_gid=DZQxGiXkA7p_47IpnzLVJw&edm=AP4sbd4BAAAA&ccb=7-5&ig_cache_key=MzQyMjMxMDExMjc1NzM0Mzk5Mw%3D%3D.3-ccb7-5&oh=00_AfPufTy404pFXC1oon-FP8IR9ena9MUFnPIB5jQiEAlg5g&oe=686501B6&_nc_sid=7a9f4b"
            />
          </div>
          <span className="text-sm text-gray-500">201 Followers</span>
        </div>
        <button className="bg-orange-300 hover:bg-rose-300 text-white font-semibold text-sm px-2 py-2 rounded-lg shadow-sm transition-all duration-200 ">
          My Profile
        </button>
      </div>
    </div>
  );
}

export default ProfileCard;
