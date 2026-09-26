import type { ImageLoaderProps } from "next/image";

/** Resizes through Cloudflare Image Transformations; allowed sources are the zone's transformation origins. */
export default function cloudflareImageLoader({
  src,
  width,
  quality,
}: ImageLoaderProps) {
  const options = [
    `width=${width}`,
    `quality=${quality ?? 75}`,
    "format=auto",
  ].join(",");
  return `/cdn-cgi/image/${options}/${src.startsWith("/") ? src.slice(1) : src}`;
}
