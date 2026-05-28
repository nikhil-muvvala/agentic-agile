import { pgTable, serial, varchar, text, integer, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { projectsTable } from "./projects.js";
import { usersTable } from "./User.js";

export const taskStatusEnum = pgEnum("task_status", ["todo", "in_progress", "done"]);

export const tasksTable = pgTable("tasks", {
    id: serial().primaryKey(),
    projectId: integer().references(() => projectsTable.id, { onDelete: "cascade" }).notNull(),
    title: varchar({ length: 255 }).notNull(),
    description: text(),
    status: taskStatusEnum().default("todo").notNull(),
    // Using restrict as you requested! Making it nullable so tasks don't have to be assigned immediately.
    assigneeId: integer().references(() => usersTable.id, { onDelete: "restrict" }),
    createdAt: timestamp().defaultNow().notNull(),
    updatedAt: timestamp().defaultNow().$onUpdateFn(() => new Date()).notNull(),
    targetDate: timestamp('target_date')
});
