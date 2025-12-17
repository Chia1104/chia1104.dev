import * as z from "zod";

import dayjs from "@chia/utils/day";

export const dateSchema = z.union([z.string(), z.number()]);

export type DateDTO = z.infer<typeof dateSchema>;

export const dateTransformSchema = z.date().transform((val) => {
  return dayjs(val).toISOString();
});

export type TransformedDateDTO = z.infer<typeof dateTransformSchema>;

export const baseInfiniteSchema = z.object({
  limit: z.number().max(50).optional().default(10),
  cursor: z.union([z.string(), z.number()]).nullish(),
  sortOrder: z.enum(["asc", "desc"]).optional().default("desc"),
});

export type BaseInfiniteDTO = z.infer<typeof baseInfiniteSchema>;
