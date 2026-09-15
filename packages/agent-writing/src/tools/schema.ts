import { Type } from "@chia/agent-runtime/tools";

export {
  LocaleSchema,
  Type,
  jsonBlock,
  textResult,
  truncate,
} from "@chia/agent-runtime/tools";

export const DraftIdSchema = Type.Integer({
  description:
    "The draft to work on, as the operator's attachment, `list_drafts`, `new_draft` or `open_draft` named it. Never guess it.",
});
