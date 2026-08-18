import { createInsertSchema, createSelectSchema } from "drizzle-orm/zod";
import * as z from "zod";

import { project, member, invitation, organization } from "../../schemas";
import { FeedOrderBy } from "../../types";

import {
  dateSchema,
  baseInfiniteSchema as baseInfiniteSchemaShared,
  dateTransformSchema,
} from "./shared";

export const insertProjectSchema = createInsertSchema(project)
  .omit({
    createdAt: true,
    deletedAt: true,
  })
  .extend({
    createdAt: dateSchema.optional(),
    deletedAt: dateSchema.optional(),
  });

export type InsertProjectDTO = z.infer<typeof insertProjectSchema>;

export const baseInfiniteSchema = baseInfiniteSchemaShared.extend({
  orderBy: z
    .enum([FeedOrderBy.CreatedAt, FeedOrderBy.Id, FeedOrderBy.Slug])
    .optional()
    .default(FeedOrderBy.CreatedAt),
});

export const infiniteSchema = baseInfiniteSchema.optional().default({
  limit: 10,
  cursor: null,
  orderBy: FeedOrderBy.CreatedAt,
  sortOrder: "desc",
});

export type InfiniteDTO = z.infer<typeof infiniteSchema>;

export const projectSchema = createSelectSchema(project).extend({
  createdAt: dateSchema,
  deletedAt: dateSchema.nullable(),
});
export type ProjectDTO = z.infer<typeof projectSchema>;

export const projectTransformSchema = projectSchema.extend({
  createdAt: dateTransformSchema,
  deletedAt: dateTransformSchema.nullable(),
});
export type ProjectTransformDTO = z.infer<typeof projectTransformSchema>;

export const memberSchema = createSelectSchema(member).extend({
  createdAt: dateSchema,
});
export type MemberDTO = z.infer<typeof memberSchema>;

export const memberTransformSchema = memberSchema.extend({
  role: z.string(),
  createdAt: dateTransformSchema,
  teamId: z.string().nullish(),
});
export type MemberTransformDTO = z.infer<typeof memberTransformSchema>;

export const invitationSchema = createSelectSchema(invitation).extend({
  expiresAt: dateSchema,
});
export type InvitationDTO = z.infer<typeof invitationSchema>;

export const invitationTransformSchema = invitationSchema.extend({
  expiresAt: dateTransformSchema,
  teamId: z.string().nullish(),
});
export type InvitationTransformDTO = z.infer<typeof invitationTransformSchema>;

export const organizationSchema = createSelectSchema(organization).extend({
  slug: z.string(),
  createdAt: dateSchema,
});
export type OrganizationDTO = z.infer<typeof organizationSchema>;

export const organizationTransformSchema = organizationSchema.extend({
  createdAt: dateTransformSchema,
  logo: z.string().nullish(),
  metadata: z.any().nullish(),
});
export type OrganizationTransformDTO = z.infer<
  typeof organizationTransformSchema
>;
