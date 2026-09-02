import * as z from "zod";

import { FeedOrderBy, Role } from "../../types";

import { baseInfiniteSchema } from "./shared";

export const listUsersSchema = baseInfiniteSchema.extend({
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
