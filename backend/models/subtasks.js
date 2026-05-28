import { pgTable, serial, integer, varchar, boolean, timestamp } from "drizzle-orm/pg-core";
import { tasksTable } from "./tasks.js";

export const subtasksTable = pgTable("subtasks", {
    id: serial().primaryKey(),
    taskId: integer().references(() => tasksTable.id, { onDelete: "cascade" }).notNull(),
    title: varchar({ length: 255 }).notNull(),
    isCompleted: boolean().default(false).notNull(),
    createdAt: timestamp().defaultNow().notNull(),
    updatedAt: timestamp().defaultNow().notNull(),
});
