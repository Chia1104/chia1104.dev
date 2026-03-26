import * as z from "zod";

export const withMetaSchema = <Out, In>(schema: z.ZodType<Out, In>) =>
  z.object({
    items: z.array(schema),
    nextCursor: z.union([z.string(), z.number()]).nullable(),
  });
