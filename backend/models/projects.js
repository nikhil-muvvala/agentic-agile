import { pgTable, varchar, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./User.js";

export const projectsTable = pgTable("projects", {
  id: serial().primaryKey(),
  name: varchar({ length: 255 }).notNull(), 
  description: text(),                       
  createdBy: integer().references(() => usersTable.id, { onDelete: "cascade" }).notNull(),
  createdAt: timestamp().defaultNow().notNull(),
  updatedAt: timestamp().defaultNow().notNull(),
});