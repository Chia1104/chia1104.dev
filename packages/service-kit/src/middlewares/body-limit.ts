import { createMiddleware } from "hono/factory";

import { AppError } from "../errors";
import type { ServiceHonoEnv } from "../hono";

/**
 * Caps the request body at `maxSize` bytes.
 *
 * Not `hono/body-limit`: for a chunked body it rebuilds as
 * `new Request(c.req.raw, { body })`. Under Nitro, `c.req.raw` is srvx's lazy
 * Request whose constructor unwraps from an already-consumed body stream, and
 * the RPC handler then throws. Building from the URL sidesteps that.
 *
 * A declared `content-length` is trusted: the HTTP parser enforces that framing.
 */
export const bodyLimit = (maxSize: number) =>
  createMiddleware<ServiceHonoEnv>(async (c, next) => {
    const raw = c.req.raw;
    if (!raw.body) {
      return next();
    }

    const tooLarge = () => new AppError("PAYLOAD_TOO_LARGE");

    const contentLength = raw.headers.get("content-length");
    if (contentLength !== null && !raw.headers.has("transfer-encoding")) {
      if (Number.parseInt(contentLength, 10) > maxSize) {
        throw tooLarge();
      }
      return next();
    }

    // Chunked: the size is only known by reading. Buffered up to the cap so an
    // oversized body is refused with a 413 before any handler sees it.
    const chunks: Uint8Array[] = [];
    let size = 0;
    const reader = raw.body.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      size += value.byteLength;
      if (size > maxSize) {
        await reader.cancel().catch(() => undefined);
        throw tooLarge();
      }
      chunks.push(value);
    }

    const body = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      body.set(chunk, offset);
      offset += chunk.byteLength;
    }

    c.req.raw = new Request(raw.url, {
      method: raw.method,
      headers: raw.headers,
      body,
      signal: raw.signal,
    });

    return next();
  });
