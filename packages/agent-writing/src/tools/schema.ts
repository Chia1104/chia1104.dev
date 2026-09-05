import { Type, toolDefiner } from "@chia/agent-runtime/tools";

import type { WritingToolContext } from "../types.ts";

export {
  LocaleSchema,
  Type,
  jsonBlock,
  textResult,
  truncate,
} from "@chia/agent-runtime/tools";

/** Pins the writing context so `execute` keeps its argument types. */
export const defineTool = toolDefiner<WritingToolContext>();

export const DraftIdSchema = Type.Integer({
  description:
    "The draft to work on, as the operator's attachment, `list_drafts` or `open_draft` named it. Never guess it.",
});
