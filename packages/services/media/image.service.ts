import type { MediaSource } from "@chia/db/types";

const FETCH_TIMEOUT_MS = 15_000;
/** Key art is a few hundred kilobytes; anything near this is not one. */
const MAX_BYTES = 12 * 1024 * 1024;

/**
 * The image CDNs of the catalogues. A URL comes out of a catalogue's API response, so anything
 * else is refused rather than fetched from inside the service's network.
 */
const IMAGE_HOSTS: ReadonlySet<string> = new Set([
  "image.tmdb.org",
  "s4.anilist.co",
  "images.igdb.com",
]);

const EXTENSIONS = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
]);

/** Which of a work's two images an object is; the word is part of its storage key. */
export const MediaImageRole = {
  Poster: "poster",
  Backdrop: "backdrop",
} as const;

export type MediaImageRole =
  (typeof MediaImageRole)[keyof typeof MediaImageRole];

export interface StoredMediaImage {
  /** Object key in the site's storage bucket. */
  key: string;
  body: Uint8Array;
}

/** Loaded on demand so the AWS SDK stays out of the boot path of processes that never store an image. */
const getS3Service = async () =>
  (await import("@chia/integrations/s3/service")).s3Service;

/** Reads the body while counting, so an oversized or endless response is dropped mid-stream. */
const readCapped = async (response: Response) => {
  if (Number(response.headers.get("content-length")) > MAX_BYTES) {
    throw new Error("Image is larger than the cap");
  }
  if (!response.body) return new Uint8Array();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for await (const chunk of response.body) {
    size += chunk.byteLength;
    if (size > MAX_BYTES) {
      throw new Error("Image is larger than the cap");
    }
    chunks.push(chunk);
  }
  const body = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body;
};

/**
 * Copies a catalogue's image into the site's storage. The key is derived from the work, so
 * adding the same work again overwrites the same object.
 */
export const storeMediaImage = async (
  source: MediaSource,
  sourceId: string,
  role: MediaImageRole,
  url: string,
  signal?: AbortSignal
): Promise<StoredMediaImage> => {
  const target = new URL(url);
  if (target.protocol !== "https:" || !IMAGE_HOSTS.has(target.hostname)) {
    throw new Error(`Image host ${target.hostname} is not a catalogue CDN`);
  }
  const timeout = AbortSignal.timeout(FETCH_TIMEOUT_MS);
  const response = await fetch(target, {
    // A redirect could leave the allowed hosts.
    redirect: "error",
    signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
  });
  if (!response.ok) {
    throw new Error(`Image responded ${response.status}`);
  }
  const contentType = response.headers.get("content-type")?.split(";")[0];
  const extension = contentType ? EXTENSIONS.get(contentType) : undefined;
  if (!contentType || !extension) {
    throw new Error(`Image has unsupported type ${contentType ?? "unknown"}`);
  }
  const body = await readCapped(response);
  const key = `media/${source.replace(":", "-")}-${sourceId}-${role}.${extension}`;
  await (await getS3Service()).uploadObject(key, body, contentType);
  return { key, body };
};

const toHexChannel = (channel: number) =>
  Math.round(channel).toString(16).padStart(2, "0");

/**
 * The dominant colour of an image as `#rrggbb`. `sharp` is native and loads on first use, so a
 * process that cannot load it fails here, where the caller can go on without a colour.
 */
export const dominantColorOf = async (image: Uint8Array): Promise<string> => {
  const { default: sharp } = await import("sharp");
  const { dominant } = await sharp(image).stats();
  return `#${toHexChannel(dominant.r)}${toHexChannel(dominant.g)}${toHexChannel(dominant.b)}`;
};

export const removeMediaImage = async (key: string) => {
  await (await getS3Service()).deleteFile(key);
};
