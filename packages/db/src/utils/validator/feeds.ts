import { z } from "zod";
import dayjs from "dayjs";

export const getSchema = z
  .object({
    take: z.number().max(50).optional().default(10),
    skip: z.number().optional().default(0),
    orderBy: z
      .enum(["createdAt", "updatedAt", "id", "slug", "title"])
      .optional()
      .default("updatedAt"),
    sortOrder: z.enum(["asc", "desc"]).optional().default("desc"),
    type: z.enum(["post", "note"]).optional().default("post"),
  })
  .optional()
  .default({
    take: 10,
    skip: 0,
    orderBy: "updatedAt",
    sortOrder: "desc",
    type: "post",
  });

export type GetDTO = z.infer<typeof getSchema>;

export const infiniteSchema = z
  .object({
    limit: z.number().max(50).optional().default(10),
    // string | number | Date | dayjs.Dayjs
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
  })
  .optional()
  .default({
    limit: 10,
    cursor: null,
    orderBy: "updatedAt",
    sortOrder: "desc",
    type: "post",
  });

export type InfiniteDTO = z.infer<typeof infiniteSchema>;
