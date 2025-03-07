import { relations } from "drizzle-orm";
import { text, timestamp } from "drizzle-orm/pg-core";

import { Role } from "../types";
import { roles } from "./enums";
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
  role: roles("role").default(Role.User).notNull(),
  createdAt: timestamp("created_at").notNull(),
});

export const invitation = pgTable("invitation", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" }),
  email: text("email").notNull(),
  role: roles("role").default(Role.User),
  status: text("status").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  inviterId: text("inviter_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
});

export const project = pgTable("project", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").unique(),
  logo: text("logo"),
  createdAt: timestamp("created_at").notNull(),
  deletedAt: timestamp("deleted_at"),
  metadata: text("metadata"),
});

export const organizationRelations = relations(organization, ({ many }) => ({
  projects: many(project),
}));

export const projectRelations = relations(project, ({ one }) => ({
  organizations: one(organization, {
    fields: [project.id],
    references: [organization.id],
  }),
}));
