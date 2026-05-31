import { pgTable, varchar, serial, text, jsonb } from "drizzle-orm/pg-core";

export const usersTable = pgTable("users", {
  id: serial().primaryKey(),
  name: varchar({ length: 255 }).notNull(),
  email: varchar({ length: 255 }).notNull().unique(),
  password: varchar({ length: 255 }).notNull(),
  refreshToken: text(),
  skills: jsonb().default([]), // Added for the Skill-Memory Agent
});
