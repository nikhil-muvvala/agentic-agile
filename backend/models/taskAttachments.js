import { pgTable, serial, integer, varchar, timestamp } from "drizzle-orm/pg-core";
import { tasksTable } from "./tasks.js";
import { usersTable } from "./User.js";

export const taskAttachmentsTable = pgTable("task_attachments", {
    id: serial().primaryKey(),
    taskId: integer().references(() => tasksTable.id, { onDelete: "cascade" }).notNull(),
    uploaderId: integer().references(() => usersTable.id, { onDelete: "set null" }), 
    fileName: varchar({ length: 255 }).notNull(), 
    fileUrl: varchar({ length: 1024 }).notNull(), 
    mimeType: varchar({ length: 100 }),           
    sizeBytes: integer(),                         
    createdAt: timestamp().defaultNow().notNull(),
});
