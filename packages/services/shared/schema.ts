import * as z from "zod";

/**
 * Accepts a JSON boolean or its query-string spelling, so the same schema works over RPC
 * (real JSON) and over the OpenAPI mount (every value a string).
 */
export const flexibleBoolean = z.union([z.boolean(), z.stringbool()]);

/** The `data` an `AppError` with issues carries on the wire (`toORPCError`), in the order they were raised. */
export const appErrorIssuesSchema = z.object({
  errors: z.array(
    z.object({
      field: z.string(),
      message: z.string(),
      code: z.string().optional(),
    })
  ),
});

export const withMetaSchema = <Out, In>(schema: z.ZodType<Out, In>) =>
  z.object({
    items: z.array(schema),
    nextCursor: z.union([z.string(), z.number()]).nullable(),
  });
