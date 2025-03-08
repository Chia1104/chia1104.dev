import { relations, sql } from "drizzle-orm";
import type { InferSelectModel } from "drizzle-orm";
import { text, timestamp, serial } from "drizzle-orm/pg-core";

import { pgTable } from "./table";
import { users as user } from "./users";

export const organization = pgTable("organization", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").unique(),
  logo: text("logo"),
  createdAt: timestamp("created_at").notNull(),
  metadata: text("metadata"),
});

export const member = pgTable("member", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" }),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  role: text("role"),
  createdAt: timestamp("created_at").notNull(),
});

export const invitation = pgTable("invitation", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" }),
  email: text("email").notNull(),
  role: text("role"),
  status: text("status").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  inviterId: text("inviter_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
});

export const project = pgTable("project", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").unique(),
  logo: text("logo"),
  createdAt: timestamp("created_at", { mode: "date" })
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
  deletedAt: timestamp("deleted_at", { mode: "date" }),
  metadata: text("metadata"),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" }),
});

export const organizationRelations = relations(organization, ({ many }) => ({
  projects: many(project),
}));

export const projectRelations = relations(project, ({ one }) => ({
  organizations: one(organization, {
    fields: [project.organizationId],
    references: [organization.id],
  }),
}));

export type Organization = InferSelectModel<typeof organization>;
export type Member = InferSelectModel<typeof member>;
export type Invitation = InferSelectModel<typeof invitation>;
export type Project = InferSelectModel<typeof project>;
