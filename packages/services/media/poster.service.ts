import type { MediaSource } from "@chia/db/types";

const FETCH_TIMEOUT_MS = 15_000;
/** A cover is a few hundred kilobytes; anything near this is not one. */
const MAX_BYTES = 8 * 1024 * 1024;

const EXTENSIONS = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
]);

/** Loaded on demand so the AWS SDK stays out of the boot path of processes that never store a cover. */
const getS3Service = async () =>
  (await import("@chia/integrations/s3/service")).s3Service;

/**
 * Copies a catalogue's cover into the site's storage and returns its object key. The key is
 * derived from the work, so adding the same work again overwrites the same object.
 */
export const storePoster = async (
  source: MediaSource,
  sourceId: string,
  url: string,
  signal?: AbortSignal
): Promise<string> => {
  const timeout = AbortSignal.timeout(FETCH_TIMEOUT_MS);
  const response = await fetch(url, {
    signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
  });
  if (!response.ok) {
    throw new Error(`Cover responded ${response.status}`);
  }
  const contentType = response.headers.get("content-type")?.split(";")[0];
  const extension = contentType ? EXTENSIONS.get(contentType) : undefined;
  if (!contentType || !extension) {
    throw new Error(`Cover has unsupported type ${contentType ?? "unknown"}`);
  }
  const body = new Uint8Array(await response.arrayBuffer());
  if (body.byteLength > MAX_BYTES) {
    throw new Error(`Cover is ${body.byteLength} bytes`);
  }
  const key = `media/${source.replace(":", "-")}-${sourceId}.${extension}`;
  await (await getS3Service()).uploadObject(key, body, contentType);
  return key;
};

export const removePoster = async (key: string) => {
  await (await getS3Service()).deleteFile(key);
};
