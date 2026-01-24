import type { ClientOptions } from "openai";
import OpenAI from "openai";

export const createOpenAI = (options?: Partial<ClientOptions>) => {
  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY ?? "st-SECRETKEY",
    ...options,
  });
};
