import { db } from "../db/index.js";
import { usersTable } from "../models/User.js";
import { eq } from "drizzle-orm";

export const validateUser = async (email) => {
  if (!email) {
    throw new Error("Email required");
  }
  const result = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, email)); //  you got array as output like [{},{}]

  return result;
};