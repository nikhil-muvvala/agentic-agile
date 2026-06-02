import { pgTable, serial, integer, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { customType } from "drizzle-orm/pg-core";
import { projectsTable } from "./projects.js";

// Custom Vector Type if 'vector' is not exported by older pg-core versions
// We specify the vector(768) type directly in postgres.
const customVector = customType({
  dataType() {
    return "vector(768)";
  },
  toDriver(value) {
    return JSON.stringify(value); // pgvector accepts JSON arrays like '[0.1, 0.2]'
  },
  fromDriver(value) {
    if (typeof value === "string") {
      return JSON.parse(value);
    }
    return value;
  }
});

// The "Project Brain" Table
// Stores embeddings of tasks, notes, and decisions for RAG retrieval.
export const projectKnowledgeTable = pgTable("project_knowledge", {
  id: serial("id").primaryKey(),
  
  projectId: integer("project_id").references(() => projectsTable.id, { onDelete: "cascade" }).notNull(),
  
  // The mathematical representation of the content
  // 768 is the exact dimension output of Gemini's text-embedding-004 model.
  embedding: customVector("embedding").notNull(),
  
  // The actual human-readable English text
  content: text("content").notNull(),
  
  // Categorizes what kind of memory this is
  memoryType: varchar("memory_type", { enum: ['task_completion', 'note_added'] }).notNull(),
  
  // The ID of the original task or note, so the AI can cite its sources!
  sourceId: integer("source_id").notNull(),
  
  createdAt: timestamp("created_at").defaultNow().notNull()
});
