import { pgTable, varchar, serial, text } from "drizzle-orm/pg-core";

export const usersTable = pgTable("users", {
  id: serial().primaryKey(),
  name: varchar({ length: 255 }).notNull(),
  email: varchar({ length: 255 }).notNull().unique(),
  password: varchar({ length: 255 }).notNull(),
  refreshToken: text(),
});
