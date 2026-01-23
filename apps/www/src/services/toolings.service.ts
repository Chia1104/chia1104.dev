import type { InferResponseType } from "hono";

import { client } from "@/libs/service/client";
import { HonoRPCError } from "@/libs/service/error";

export type LinkPreviewResponse = InferResponseType<
  (typeof client.api.v1.toolings)["link-preview"]["$post"],
  200
>;

export const getLinkPreview = async (href: string, _signal?: AbortSignal) => {
  try {
    const res = await client.api.v1.toolings["link-preview"].$post({
      json: { href },
    });
    if (!res.ok) {
      throw new HonoRPCError(res.statusText, res.status, res.statusText);
    }
    return res.json();
  } catch (error) {
    if (error instanceof HonoRPCError) {
      throw error;
    }
    throw new HonoRPCError("unknown error", 500, "unknown error");
  }
};
