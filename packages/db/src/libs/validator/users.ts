import * as z from "zod";

import { FeedOrderBy, Role } from "../../types";

import { baseInfiniteSchema } from "./shared";

/** `<timestamp as Postgres text>|<user id>`, as `listUsers` hands it back in `nextCursor`. */
export const USER_CURSOR_PATTERN =
  /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(\.\d{1,6})?\|[^|]+$/;

export const listUsersSchema = baseInfiniteSchema.extend({
  cursor: z.string().regex(USER_CURSOR_PATTERN).nullish(),
  orderBy: z
    .enum([FeedOrderBy.CreatedAt, FeedOrderBy.UpdatedAt])
    .optional()
    .default(FeedOrderBy.CreatedAt),
  /** Substring match on name and email. */
  query: z.string().max(200).optional(),
  role: z.enum(Role).optional(),
  banned: z.boolean().optional(),
  /** `true` lists guests only, `false` signed-in accounts only. */
  anonymous: z.boolean().optional(),
});

export type ListUsersDTO = z.infer<typeof listUsersSchema>;
