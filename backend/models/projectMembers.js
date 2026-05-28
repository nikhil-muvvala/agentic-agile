import { pgTable, serial, integer, pgEnum, timestamp, unique, varchar } from "drizzle-orm/pg-core";
import { projectsTable } from "./projects.js";
import { usersTable } from "./User.js";

export const roleEnum = pgEnum("role", ["admin", "project_admin", "member"]);

export const projectMembers = pgTable("project_members", {
  id: serial().primaryKey(),
  projectId: integer().references(() => projectsTable.id, { onDelete: "cascade" }).notNull(),
  userId: integer().references(() => usersTable.id, { onDelete: "cascade" }).notNull(),
  role: roleEnum().notNull().default("member"),
  createdAt: timestamp().defaultNow().notNull(),
}, (table) => ({
  uniqueMember: unique().on(table.projectId, table.userId) 
}));