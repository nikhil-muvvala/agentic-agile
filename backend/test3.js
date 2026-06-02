import 'dotenv/config';
import { aiClient } from './config/ai.js';
import { db } from './db/index.js';
import { projectKnowledgeTable } from './models/index.js';
import { eq, and, sql } from 'drizzle-orm';

async function main() {
    const question = 'Did we implement anything to stop DDoS attacks on the API';
    const embedResponse = await aiClient.models.embedContent({
        model: 'gemini-embedding-2',
        config: { outputDimensionality: 768 },
        contents: question
    });
    const queryVector = embedResponse.embeddings[0].values;
    const similaritySQL = sql`1 - (${projectKnowledgeTable.embedding} <=> ${JSON.stringify(queryVector)})`;
    const memories = await db.select({
        content: projectKnowledgeTable.content,
        similarity: similaritySQL
    }).from(projectKnowledgeTable);
    console.log(memories);
}
main();
