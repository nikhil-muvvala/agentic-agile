import 'dotenv/config';
import { db } from './db/index.js';
import { projectKnowledgeTable } from './models/index.js';
import { eq, and, sql } from 'drizzle-orm';

const queryVector = new Array(768).fill(0.1);
const similaritySQL = sql`1 - (${projectKnowledgeTable.embedding} <=> ${JSON.stringify(queryVector)})`;

db.select({ content: projectKnowledgeTable.content })
  .from(projectKnowledgeTable)
  .where(and(eq(projectKnowledgeTable.projectId, 4), sql`${similaritySQL} > 0.75`))
  .limit(1)
  .then(console.log)
  .catch(console.error)
  .finally(() => process.exit(0));
