import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import * as z from "zod";

import { project, member, invitation, organization } from "../../schemas";
import { FeedOrderBy } from "../../types";
import {
  dateSchema,
  baseInfiniteSchema as baseInfiniteSchemaShared,
  dateTransformSchema,
} from "./shared";

export const insertProjectSchema = z.object({
  ...createInsertSchema(project).omit({
    createdAt: true,
    deletedAt: true,
  }).shape,
  createdAt: dateSchema.optional(),
  deletedAt: dateSchema.optional(),
});

export type InsertProjectDTO = z.infer<typeof insertProjectSchema>;

export const baseInfiniteSchema = z.object({
  ...baseInfiniteSchemaShared.shape,
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

export const projectSchema = z.object({
  ...createSelectSchema(project).shape,
  createdAt: dateSchema,
  deletedAt: dateSchema.nullable(),
});
export type ProjectDTO = z.infer<typeof projectSchema>;

export const projectTransformSchema = z.object({
  ...projectSchema.shape,
  createdAt: dateTransformSchema,
  deletedAt: dateTransformSchema.nullable(),
});
export type ProjectTransformDTO = z.infer<typeof projectTransformSchema>;

export const memberSchema = z.object({
  ...createSelectSchema(member).shape,
  createdAt: dateSchema,
});
export type MemberDTO = z.infer<typeof memberSchema>;

export const memberTransformSchema = z.object({
  ...memberSchema.shape,
  role: z.string(),
  createdAt: dateTransformSchema,
  teamId: z.string().nullish(),
});
export type MemberTransformDTO = z.infer<typeof memberTransformSchema>;

export const invitationSchema = z.object({
  ...createSelectSchema(invitation).shape,
  expiresAt: dateSchema,
});
export type InvitationDTO = z.infer<typeof invitationSchema>;

export const invitationTransformSchema = z.object({
  ...invitationSchema.shape,
  expiresAt: dateTransformSchema,
  teamId: z.string().nullish(),
});
export type InvitationTransformDTO = z.infer<typeof invitationTransformSchema>;

export const organizationSchema = z.object({
  ...createSelectSchema(organization).shape,
  slug: z.string(),
  createdAt: dateSchema,
});
export type OrganizationDTO = z.infer<typeof organizationSchema>;

export const organizationTransformSchema = z.object({
  ...organizationSchema.shape,
  createdAt: dateTransformSchema,
  logo: z.string().nullish(),
  metadata: z.any().nullish(),
});
export type OrganizationTransformDTO = z.infer<
  typeof organizationTransformSchema
>;
