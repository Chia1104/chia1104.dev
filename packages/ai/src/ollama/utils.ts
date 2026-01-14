import * as z from "zod";

import { ollama } from "./index.ts";
import { OllamaModel } from "./types.ts";

export const isOllamaModel = (model?: unknown): model is OllamaModel => {
  return z.enum(OllamaModel).safeParse(model).success;
};

export const isOllamaEnabled = async (model?: OllamaModel) => {
  try {
    const models = await ollama.list();
    if (model) {
      return models.models.some((m) => m.model.match(model));
    }
    return true;
  } catch {
    return false;
  }
};
