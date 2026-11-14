import type { MediaSource } from "@chia/db/types";

const FETCH_TIMEOUT_MS = 15_000;
/** Key art is a few hundred kilobytes; anything near this is not one. */
const MAX_BYTES = 12 * 1024 * 1024;

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
  const timeout = AbortSignal.timeout(FETCH_TIMEOUT_MS);
  const response = await fetch(url, {
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
  const body = new Uint8Array(await response.arrayBuffer());
  if (body.byteLength > MAX_BYTES) {
    throw new Error(`Image is ${body.byteLength} bytes`);
  }
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
