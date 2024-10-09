import OpenAI from "openai";
import type { ClientOptions } from "openai";

export const createOpenAI = (options?: Partial<ClientOptions>) => {
  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY ?? "st-SECRETKEY",
    ...options,
  });
};
