export default function cloudinaryLoader({
  src,
  width,
  quality,
}: {
  src: string;
  width: number;
  quality?: number;
}) {
  const params = ["f_auto", "c_limit", `w_${width}`, `q_${quality || "auto"}`];

  if (src.includes('clerk.com')) {
     return src
  }
  if (src.startsWith('/') ) {
     return src
  }
  // If the src is already a full Cloudinary URL, inject the optimization params
  if (src.includes("res.cloudinary.com")) {
    const splitUrl = src.split("/upload/");
    // If it's already a valid Cloudinary URL, put the params right after /upload/
    if (splitUrl.length === 2) {
      return `${splitUrl[0]}/upload/${params.join(",")}/${splitUrl[1]}`;
    }
  }

  return `https://res.cloudinary.com/drlvgvx1l/image/upload/${params.join(",")}/${src}`;
}
