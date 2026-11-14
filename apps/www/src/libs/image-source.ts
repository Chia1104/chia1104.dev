import { env } from "@/env";
import cloudflareImageLoader from "@/libs/image-loader";

/**
 * A URL for a storage image whose pixels script may read, fetched without a referrer.
 * `/cdn-cgi/image` is same-origin but exists only on the production zone. Elsewhere storage is
 * read directly, under a URL of its own: storage sends `Vary: Origin` only to a request that has
 * an origin, so the copy an `<img>` left in the browser's cache would answer a CORS read without
 * its headers.
 */
export const readableImageSourceOf = (url: string, width: number) =>
  env.NEXT_PUBLIC_ENV === "production"
    ? cloudflareImageLoader({ src: url, width, quality: 70 })
    : `${url}?cors`;
