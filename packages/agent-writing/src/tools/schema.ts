import * as z from "zod";

export const DraftIdSchema = z
  .number()
  .int()
  .describe(
    "The draft to work on, as the operator's attachment, `list_drafts`, `new_draft` or `open_draft` named it. Never guess it."
  );
