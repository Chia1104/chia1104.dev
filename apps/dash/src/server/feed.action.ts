"use server";

import { z } from "zod";

import { serviceRequest } from "@chia/utils";

import { env } from "@/env";

import { action } from "./action";

export const generateFeedEmbedding = action
  .schema(
    z.object({
      feedID: z.string(),
    })
  )
  .action(async ({ parsedInput }) => {
    await serviceRequest({
      isInternal: true,
      internal_requestSecret: {
        cfBypassToken: env.CF_BYPASS_TOKEN,
        apiKey: env.CH_API_KEY,
      },
    }).post(`trigger/feed-embeddings`, {
      json: parsedInput,
    });
  });
