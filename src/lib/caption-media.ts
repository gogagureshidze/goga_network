const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

export function validateCaptionMediaUrl(value: string): URL {
  const url = new URL(value);
  const cloud = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || "drlvgvx1l";
  if (url.protocol !== "https:" || url.hostname !== "res.cloudinary.com" || url.port || url.username || url.password || !url.pathname.startsWith(`/${cloud}/image/upload/`)) {
    throw new Error("Only uploaded images from this application's media library are supported");
  }
  return url;
}

export async function fetchCaptionImage(value: string) {
  const url = validateCaptionMediaUrl(value);
  const response = await fetch(url, { redirect: "error", signal: AbortSignal.timeout(10_000), cache: "no-store" });
  if (!response.ok || !response.body) throw new Error("Media unavailable");
  const mimeType = response.headers.get("content-type")?.split(";")[0].trim().toLowerCase();
  if (!mimeType || !IMAGE_TYPES.has(mimeType)) {
    await response.body.cancel();
    throw new Error("Unsupported image type");
  }
  if (Number(response.headers.get("content-length")) > MAX_IMAGE_BYTES) {
    await response.body.cancel();
    throw new Error("Image exceeds 5 MB");
  }
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    while (true) {
      const { done, value: chunk } = await reader.read();
      if (done) break;
      bytes += chunk.byteLength;
      if (bytes > MAX_IMAGE_BYTES) throw new Error("Image exceeds 5 MB");
      chunks.push(chunk);
    }
  } finally {
    await reader.cancel();
    reader.releaseLock();
  }
  return { mimeType, data: Buffer.concat(chunks).toString("base64") };
}
