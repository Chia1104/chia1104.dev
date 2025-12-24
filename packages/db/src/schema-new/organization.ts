import { relations, sql } from "drizzle-orm";
import type { InferSelectModel } from "drizzle-orm";
import {
  text,
  timestamp,
  serial,
  index,
  uniqueIndex,
  jsonb,
} from "drizzle-orm/pg-core";

import { timestamps, softDelete } from "./common";
import { invitationStatus, memberRole } from "./enums";
import { pgTable } from "./table";
import { users } from "./users";

export const organization = pgTable(
  "organization",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    slug: text("slug").unique().notNull(),
    logo: text("logo"),
    createdAt: timestamp("created_at", { mode: "date" })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    metadata: jsonb("metadata"),
  },
  (table) => [
    uniqueIndex("organization_slug_index").on(table.slug),
    index("organization_name_index").on(table.name),
  ]
);

export const member = pgTable(
  "member",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: memberRole("role").default("member").notNull(),
    createdAt: timestamp("created_at", { mode: "date" })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (table) => [
    index("member_organization_id_index").on(table.organizationId),
    index("member_user_id_index").on(table.userId),
    uniqueIndex("member_org_user_index").on(table.organizationId, table.userId),
  ]
);

export const invitation = pgTable(
  "invitation",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    role: memberRole("role").default("member").notNull(),
    status: invitationStatus("status").default("pending").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    inviterId: text("inviter_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { mode: "date" })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (table) => [
    index("invitation_organization_id_index").on(table.organizationId),
    index("invitation_email_index").on(table.email),
    index("invitation_inviter_id_index").on(table.inviterId),
  ]
);

export const project = pgTable(
  "project",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    slug: text("slug").unique().notNull(),
    logo: text("logo"),
    ...timestamps,
    ...softDelete,
    metadata: jsonb("metadata"),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
  },
  (table) => [
    uniqueIndex("project_slug_index").on(table.slug),
    index("project_organization_id_index").on(table.organizationId),
    index("project_name_index").on(table.name),
  ]
);

// Relations
export const organizationRelations = relations(organization, ({ many }) => ({
  projects: many(project),
  members: many(member),
  invitations: many(invitation),
}));

export const memberRelations = relations(member, ({ one }) => ({
  organization: one(organization, {
    fields: [member.organizationId],
    references: [organization.id],
  }),
  user: one(users, {
    fields: [member.userId],
    references: [users.id],
  }),
}));

export const invitationRelations = relations(invitation, ({ one }) => ({
  organization: one(organization, {
    fields: [invitation.organizationId],
    references: [organization.id],
  }),
  inviter: one(users, {
    fields: [invitation.inviterId],
    references: [users.id],
  }),
}));

export const projectRelations = relations(project, ({ one }) => ({
  organization: one(organization, {
    fields: [project.organizationId],
    references: [organization.id],
  }),
}));

export type Organization = InferSelectModel<typeof organization>;
export type Member = InferSelectModel<typeof member>;
export type Invitation = InferSelectModel<typeof invitation>;
export type Project = InferSelectModel<typeof project>;
