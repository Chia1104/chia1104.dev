"use server";

import { redirect } from "next/navigation";
import crypto from "node:crypto";
import * as z from "zod";

import { action } from "./action";

export const generateFeedEmbedding = action.action(() => {
  throw new Error("Not implemented");
});

export const generateFeedDraftSecret = action
  .inputSchema(
    z.object({
      slug: z.string(),
      type: z.enum(["post", "note"]),
    })
  )
  .action(async ({ clientInput }) => {
    const SHA_256_HASH = process.env.SHA_256_HASH;

    const key = crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(SHA_256_HASH),
      { name: "HMAC", hash: { name: "SHA-256" } },
      false,
      ["sign"]
    );

    const toHex = (arrayBuffer: ArrayBuffer) => {
      return Array.prototype.map
        .call(new Uint8Array(arrayBuffer), (n) =>
          n.toString(16).padStart(2, "0")
        )
        .join("");
    };

    const secret = toHex(
      await crypto.subtle.sign(
        "HMAC",
        await key,
        new TextEncoder().encode(JSON.stringify(clientInput))
      )
    );

    const response = await fetch(
      `http://localhost:3000/api/v1/feed/draft?slug=${clientInput.slug}&type=${clientInput.type}&secret=${secret}`
    );

    if (!response.ok) {
      throw new Error("Failed to generate feed draft secret");
    }

    redirect(
      `http://localhost:3000/feed/draft/${clientInput.type}/${clientInput.slug}`
    );
  });
