import { db } from "../db/index.js";
import { projectsTable } from "../models/projects.js";
import { eq, and } from "drizzle-orm";

export const validateProject = async (userid,name) => {
  if (!userid || !name) {
    throw new Error("id and name should not be empty");
  }
  const result = await db
    .select()
    .from(projectsTable)
    .where(
    and(
    eq(projectsTable.createdBy, userid),
    eq(projectsTable.name, name)
    )
    );  
  return result;
};