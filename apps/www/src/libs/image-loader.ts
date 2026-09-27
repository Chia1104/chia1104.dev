import type { ImageLoaderProps } from "next/image";

/** Cloudflare transforms AVIF sources only on Enterprise plans; other plans answer 415 (error 9520). */
const UNTRANSFORMABLE_SOURCE = /\.avif(?:[?#]|$)/i;

/** Resizes through Cloudflare Image Transformations; allowed sources are the zone's transformation origins. */
export default function cloudflareImageLoader({
  src,
  width,
  quality,
}: ImageLoaderProps) {
  if (UNTRANSFORMABLE_SOURCE.test(src)) {
    return src;
  }
  const options = [
    `width=${width}`,
    `quality=${quality ?? 75}`,
    "format=auto",
  ].join(",");
  return `/cdn-cgi/image/${options}/${src.startsWith("/") ? src.slice(1) : src}`;
}
