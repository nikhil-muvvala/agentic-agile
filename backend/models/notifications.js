import { pgTable, varchar, serial, text, integer, timestamp, boolean } from "drizzle-orm/pg-core";
import { usersTable } from "./User.js";

export const notificationsTable = pgTable("notifications", {
  id: serial().primaryKey(),
  message: text(),                       
  userId: integer().references(() => usersTable.id, { onDelete: "cascade" }).notNull(),
  senderId: integer().references(() => usersTable.id, { onDelete: "cascade" }).notNull(),
  isRead: boolean().default(false).notNull(),
  createdAt: timestamp().defaultNow().notNull(),
  updatedAt: timestamp().defaultNow().notNull(),
});