import { toolDefiner } from "@chia/agent-runtime/tools";

import type { WritingToolContext } from "../types.ts";

export {
  LocaleSchema,
  Type,
  jsonBlock,
  textResult,
  truncate,
} from "@chia/agent-runtime/tools";

/** Pins the writing context so `execute` keeps its argument types — see `toolDefiner`. */
export const defineTool = toolDefiner<WritingToolContext>();
