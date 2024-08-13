import dayjs from "dayjs";
import { z } from "zod";

export const baseInfiniteSchema = z.object({
  limit: z.number().max(50).optional().default(10),
  cursor: z
    .union([
      z.string(),
      z.number(),
      z.date(),
      z.instanceof(dayjs as unknown as typeof dayjs.Dayjs),
    ])
    .nullish(),
  orderBy: z
    .enum(["createdAt", "updatedAt", "id", "slug", "title"])
    .optional()
    .default("updatedAt"),
  sortOrder: z.enum(["asc", "desc"]).optional().default("desc"),
  type: z.enum(["post", "note"]).optional().default("post"),
});

export const infiniteSchema = baseInfiniteSchema.optional().default({
  limit: 10,
  cursor: null,
  orderBy: "updatedAt",
  sortOrder: "desc",
  type: "post",
});

export type InfiniteDTO = z.infer<typeof infiniteSchema>;

export const getPublicFeedBySlugSchema = z.object({
  type: z.enum(["post", "note"]).optional().default("post"),
  slug: z.string().min(1),
});

export type GetPublicFeedBySlugDTO = z.infer<typeof getPublicFeedBySlugSchema>;
