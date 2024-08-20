"use server";

import { cookies } from "next/headers";
import { z } from "zod";

import { HEADER_AUTH_TOKEN } from "@chia/ai/constants";
import { encodeApiKey } from "@chia/ai/utils";

import { env } from "@/env";

import { action } from "./action";

const openaiApiKeySchema = z.object({
  apiKey: z.string().min(1),
});

export const saveOpenaiApiKey = action
  .schema(openaiApiKeySchema)
  // eslint-disable-next-line @typescript-eslint/require-await
  .action(async ({ parsedInput: { apiKey } }) => {
    cookies().set(
      HEADER_AUTH_TOKEN,
      encodeApiKey(apiKey, env.AI_AUTH_SECRET ?? ""),
      {
        secure: env.NODE_ENV === "production",
        httpOnly: true,
      }
    );
  });
