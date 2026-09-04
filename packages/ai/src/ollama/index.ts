import { Ollama } from "ollama";

import { env } from "../env.ts";

export const ollama = new Ollama({ host: env.OLLAMA_BASE_URL });
