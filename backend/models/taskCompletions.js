import { pgTable, serial, integer, jsonb, timestamp, real } from "drizzle-orm/pg-core";
import { tasksTable } from "./tasks.js";
import { usersTable } from "./User.js";

export const taskCompletionsTable = pgTable("task_completions", {
    id: serial().primaryKey(),
    taskId: integer().references(() => tasksTable.id, { onDelete: "cascade" }).notNull(),
    assigneeId: integer().references(() => usersTable.id, { onDelete: "cascade" }).notNull(),
    vector: jsonb().notNull(), // Stores the 384-dimensional Xenova Embedding array
    daysToComplete: real().notNull(), // E.g., 2.5 days
    completedAt: timestamp().defaultNow().notNull()
});
