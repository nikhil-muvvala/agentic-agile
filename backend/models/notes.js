import { pgTable, serial, integer, varchar, text, timestamp } from "drizzle-orm/pg-core";
import { projectsTable } from "./projects.js";
import { usersTable } from "./User.js";

export const notesTable = pgTable("notes", {
    id: serial().primaryKey(),
    projectId: integer().references(() => projectsTable.id, { onDelete: "cascade" }).notNull(),
    title: varchar({ length: 255 }).notNull(),
    content: text(),
    // Who created this note? Set null if the user is ever deleted.
    createdBy: integer().references(() => usersTable.id, { onDelete: "set null" }),
    createdAt: timestamp().defaultNow().notNull(),
    updatedAt: timestamp().defaultNow().notNull(),
});
