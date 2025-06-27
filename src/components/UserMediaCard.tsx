import Image from "next/image";
import Link from "next/link";
import React from "react";

function UserMediaCard({ userId }: { userId: string }) {
  return (
    <div className="p-4 bg-white rounded-lg shadow-md text-sm flex flex-col gap-4">
      <div className="flex items-center justify-between font-medium">
        <span className="text-gray-500">User Media</span>
        <Link href={"/"} className="text-orange-300 text-sm">
          See all
        </Link>
      </div>

      <div className="flex gap-4 justify-between flex-wrap">
        {/* Image Card */}
        <div className="relative w-[19%] aspect-square">
          <Image
            src="https://instagram.ftbs10-1.fna.fbcdn.net/v/t51.2885-15/497781479_18061476761118326_231756166112197812_n.jpg?se=-1&stp=dst-jpegr_e35_p412x412_tt6&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0uaW1hZ2VfdXJsZ2VuLjE0NDB4MTgwMC5oZHIuZjc1NzYxLmRlZmF1bHRfaW1hZ2UifQ&_nc_ht=instagram.ftbs10-1.fna.fbcdn.net&_nc_cat=102&_nc_oc=Q6cZ2QEo5XdyTCk37xUkQ_6a3KrXqGWIecngKCMkBlpzFb_8oJAjHqD9FujVlcNYNOC20Z4&_nc_ohc=QVmArhflSvoQ7kNvwH27Esz&_nc_gid=DZQxGiXkA7p_47IpnzLVJw&edm=AP4sbd4BAAAA&ccb=7-5&ig_cache_key=MzYzNDMzMjE4NjI5OTA3NjEwOA%3D%3D.3-ccb7-5&oh=00_AfPFXgnW-nlABVSDSBueCZRoXcfBXUHrNQ-wDMg_gwRR5g&oe=6864DFFA&_nc_sid=7a9f4b"
            alt=""
            fill
            className="object-cover rounded-md"
          />
        </div>

        <div className="relative w-[19%] aspect-square">
          <Image
            src="https://instagram.ftbs10-1.fna.fbcdn.net/v/t51.2885-15/499158447_18061476758118326_790202711631041037_n.jpg?se=-1&stp=dst-jpegr_e35_p412x412_tt6&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0uaW1hZ2VfdXJsZ2VuLjE0NDB4MTgwMC5oZHIuZjc1NzYxLmRlZmF1bHRfaW1hZ2UifQ&_nc_ht=instagram.ftbs10-1.fna.fbcdn.net&_nc_cat=102&_nc_oc=Q6cZ2QEo5XdyTCk37xUkQ_6a3KrXqGWIecngKCMkBlpzFb_8oJAjHqD9FujVlcNYNOC20Z4&_nc_ohc=uZxf-YuQRVoQ7kNvwFnB4Ex&_nc_gid=DZQxGiXkA7p_47IpnzLVJw&edm=AP4sbd4BAAAA&ccb=7-5&ig_cache_key=MzYzNDMzMjE4NjYwMTMwMDIzMg%3D%3D.3-ccb7-5&oh=00_AfNpyNRg5124TNAWVkwpAsuwg2t73vLrzq4oDPzQHV5MmQ&oe=6865081B&_nc_sid=7a9f4b"
            alt=""
            fill
            className="object-cover rounded-md"
          />
        </div>

        <div className="relative w-[19%] aspect-square">
          <Image
            alt=""
            src={
              "https://instagram.ftbs10-1.fna.fbcdn.net/v/t51.29350-15/453144461_1855041181639717_8895810564975077718_n.jpg?stp=dst-jpg_e35_p412x412_tt6&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0uaW1hZ2VfdXJsZ2VuLjE0NDB4MTgwMC5zZHIuZjI5MzUwLmRlZmF1bHRfaW1hZ2UifQ&_nc_ht=instagram.ftbs10-1.fna.fbcdn.net&_nc_cat=101&_nc_oc=Q6cZ2QEo5XdyTCk37xUkQ_6a3KrXqGWIecngKCMkBlpzFb_8oJAjHqD9FujVlcNYNOC20Z4&_nc_ohc=66La8rdi08QQ7kNvwGvB-Dn&_nc_gid=DZQxGiXkA7p_47IpnzLVJw&edm=AP4sbd4BAAAA&ccb=7-5&ig_cache_key=MzQyMjMxMDExMjc1NzM0Mzk5Mw%3D%3D.3-ccb7-5&oh=00_AfPufTy404pFXC1oon-FP8IR9ena9MUFnPIB5jQiEAlg5g&oe=686501B6&_nc_sid=7a9f4b"
            }
            fill
            className="object-cover rounded-md"
          />
        </div>

        <div className="relative w-[19%] aspect-square">
          <Image
            src="https://instagram.ftbs10-1.fna.fbcdn.net/v/t51.2885-19/497437580_18060982196118326_2767393073914947572_n.jpg?stp=dst-jpg_e0_s150x150_tt6&_nc_ht=instagram.ftbs10-1.fna.fbcdn.net&_nc_cat=102&_nc_oc=Q6cZ2QEQfyteWPCX6qAAXR2NKLUMLQk_W6zvsx4Kgt2GbIGywmJDHNVwefIikUQXLFz6Zak&_nc_ohc=2HzR0ZjWsKsQ7kNvwEhU7w3&_nc_gid=QmxXKhs-3lHMW4HliiJNew&edm=ALQROFkBAAAA&ccb=7-5&oh=00_AfPDaug8tAxuYopxmkjVd-hRS2n33AqiQRKqQSB5qMIFaQ&oe=6864E540&_nc_sid=fc8dfb"
            alt=""
            fill
            className="object-cover rounded-md"
          />
        </div>

        <div className="relative w-[19%] aspect-square">
          <Image
            src="https://instagram.ftbs10-1.fna.fbcdn.net/v/t51.2885-15/499550683_18066685685073611_2487341391231582347_n.jpg?stp=dst-jpg_e35_p412x412_tt6&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0uaW1hZ2VfdXJsZ2VuLjE0Mzl4MTc0NS5zZHIuZjc1NzYxLmRlZmF1bHRfaW1hZ2UifQ&_nc_ht=instagram.ftbs10-1.fna.fbcdn.net&_nc_cat=111&_nc_oc=Q6cZ2QFZ2zrhQCSsYTQiXjaXEW3XMeyOwmB-8R-ILUI_SciBShXuDhsaruUQBJQcLNm_MeY&_nc_ohc=ueAkoankvcYQ7kNvwFIb7rD&_nc_gid=V2b1Pnb_YzMibufLves4gw&edm=AP4sbd4BAAAA&ccb=7-5&ig_cache_key=MzYzNDY4MTAwMzYwMzE2NTUyMg%3D%3D.3-ccb7-5&oh=00_AfMHsyDXO_IwFzFBPGClaspE6RLVBJ8Pp-SIAg0g_vjT5w&oe=6864F934&_nc_sid=7a9f4b"
            alt=""
            fill
            className="object-cover rounded-md"
          />
        </div>

        <div className="relative w-[19%] aspect-square">
          <Image
            src="https://instagram.ftbs10-1.fna.fbcdn.net/v/t51.2885-19/499306425_18066826952073611_5477633146529755448_n.jpg?_nc_ht=instagram.ftbs10-1.fna.fbcdn.net&_nc_cat=111&_nc_oc=Q6cZ2QFZ2zrhQCSsYTQiXjaXEW3XMeyOwmB-8R-ILUI_SciBShXuDhsaruUQBJQcLNm_MeY&_nc_ohc=nEyQsuInU2kQ7kNvwGp3kMd&_nc_gid=V2b1Pnb_YzMibufLves4gw&edm=AP4sbd4BAAAA&ccb=7-5&oh=00_AfO4zQryFOOjF3NPM3dH2EavqkG_FT0imeV61kcsFG_KbQ&oe=6864EB83&_nc_sid=7a9f4b"
            alt=""
            fill
            className="object-cover rounded-md"
          />
        </div>
        <div className="relative w-[19%] aspect-square">
          <Image
            src="https://instagram.ftbs10-1.fna.fbcdn.net/v/t51.2885-15/501790780_18067474049073611_3640128945978158676_n.jpg?stp=dst-jpg_e35_p1170x1170_tt6&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0uaW1hZ2VfdXJsZ2VuLjE0NDB4MTgwMC5zZHIuZjc1NzYxLmRlZmF1bHRfaW1hZ2UifQ&_nc_ht=instagram.ftbs10-1.fna.fbcdn.net&_nc_cat=111&_nc_oc=Q6cZ2QG5ykRNXArk3s8K6odOLyRRRGtTqz6qpZpVI46CMsq_BXoHVX-iyxKnXhFDpwmAYx4&_nc_ohc=FXTROgcw_1AQ7kNvwG_CP8P&_nc_gid=8U2M5kAL-Ln5e5zXNa1FCg&edm=ALQROFkBAAAA&ccb=7-5&ig_cache_key=MzY0MDUwNTk2MTE2ODM5MjQxOQ%3D%3D.3-ccb7-5&oh=00_AfPLjKjg0EToxVSjjjIj-LrUbJhmulg1pfUcFgdUtV_X0A&oe=6864EEE3&_nc_sid=fc8dfb"
            alt=""
            fill
            className="object-cover rounded-md"
          />
        </div>
        <div className="relative w-[19%] aspect-square">
          <Image
            src="https://instagram.ftbs10-1.fna.fbcdn.net/v/t51.2885-15/500648173_18067474040073611_7347304268529771155_n.jpg?stp=dst-jpg_e35_p412x412_tt6&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0uaW1hZ2VfdXJsZ2VuLjE0NDB4MTgwMC5zZHIuZjc1NzYxLmRlZmF1bHRfaW1hZ2UifQ&_nc_ht=instagram.ftbs10-1.fna.fbcdn.net&_nc_cat=111&_nc_oc=Q6cZ2QG5ykRNXArk3s8K6odOLyRRRGtTqz6qpZpVI46CMsq_BXoHVX-iyxKnXhFDpwmAYx4&_nc_ohc=4wN_A-yP9-cQ7kNvwEPXpit&_nc_gid=8U2M5kAL-Ln5e5zXNa1FCg&edm=ALQROFkBAAAA&ccb=7-5&ig_cache_key=MzY0MDUwNTk2MTE1MTUyOTk4MA%3D%3D.3-ccb7-5&oh=00_AfNZL3WBQSpQfDh-ULSl8Mmd6ORZmu6a_74-W8eBcbArrA&oe=6864EC4B&_nc_sid=fc8dfb"
            alt=""
            fill
            className="object-cover rounded-md"
          />
        </div>
      </div>
    </div>
  );
}

export default UserMediaCard;
