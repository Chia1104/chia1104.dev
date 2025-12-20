import { draftMode } from "next/headers";
import crypto from "node:crypto";

import { env } from "@/env";
import { getFeedBySlug } from "@/services/feeds.service";

const key = crypto.subtle.importKey(
  "raw",
  new TextEncoder().encode(env.SHA_256_HASH),
  { name: "HMAC", hash: { name: "SHA-256" } },
  false,
  ["sign"]
);

const toHex = (arrayBuffer: ArrayBuffer) => {
  return Array.prototype.map
    .call(new Uint8Array(arrayBuffer), (n) => n.toString(16).padStart(2, "0"))
    .join("");
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const secret = searchParams.get("secret");
  const slug = searchParams.get("slug");
  const type = searchParams.get("type");

  if (!secret || !slug) {
    return new Response("Invalid request", { status: 400 });
  }

  const verifyToken = toHex(
    await crypto.subtle.sign(
      "HMAC",
      await key,
      new TextEncoder().encode(JSON.stringify({ slug, type }))
    )
  );

  if (verifyToken !== secret) {
    return new Response("Invalid secret", { status: 401 });
  }

  const feed = await getFeedBySlug(slug);

  if (!feed) {
    return new Response("Invalid slug", { status: 401 });
  }

  const draft = await draftMode();
  draft.enable();

  return new Response("OK", { status: 200 });
}

export const OPTIONS = () => {
  return new Response("OK", {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
};
